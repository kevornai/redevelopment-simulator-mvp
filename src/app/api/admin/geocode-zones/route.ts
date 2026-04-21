/**
 * 좌표 없는 구역 일괄 지오코딩 API
 * POST /api/admin/geocode-zones
 * gyeonggi_zones에서 lat/lng NULL인 구역을 찾아 카카오 REST API로 좌표 채움
 * 좌표 확보 후 역지오코딩으로 bjd_code(10자리)·lawd_cd(구 레벨 5자리) 동시 저장
 * 우선순위: locplc_addr(실제주소) → sigun_nm + imprv_zone_nm(구역명)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

async function searchAddress(q: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(4000) }
  );
  const json = await res.json();
  const doc = json.documents?.[0];
  return doc ? { lat: parseFloat(doc.y), lng: parseFloat(doc.x) } : null;
}

async function searchKeyword(q: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=1`,
    { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(4000) }
  );
  const json = await res.json();
  const doc = json.documents?.[0];
  return doc ? { lat: parseFloat(doc.y), lng: parseFloat(doc.x) } : null;
}

/**
 * 지오코딩 우선순위:
 * 1. locplc_addr 주소 검색
 * 2. locplc_addr + "번지" 주소 검색
 * 3. 원본 구역명(시군명+구역명, 괄호 포함) 키워드 검색
 */
async function geocodeWithFallbacks(
  primary: string | null,
  zoneName: string,  // "sigun_nm imprv_zone_nm" 조합
): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY) return null;
  try {
    // 1. locplc_addr 주소 검색
    if (primary) {
      const r = await searchAddress(primary);
      if (r) return r;

      // 2. locplc_addr + "번지"
      const withBunji = primary.replace(/(\d+)\s*$/, "$1번지");
      if (withBunji !== primary) {
        const r2 = await searchAddress(withBunji);
        if (r2) return r2;
      }
    }

    // 3. 원본 구역명 키워드 검색
    const r3 = await searchKeyword(zoneName);
    if (r3) return r3;

    return null;
  } catch { return null; }
}

/** 좌표 → 법정동코드(10자리) + 시군구코드(5자리) */
async function reverseGeocode(lat: number, lng: number): Promise<{ bjdCode: string; lawdCd: string } | null> {
  if (!KAKAO_REST_KEY) return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}&input_coord=WGS84`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(4000) }
    );
    const json = await res.json();
    // region_type "B" = 법정동
    const region = json.documents?.find((d: { region_type: string }) => d.region_type === "B");
    if (!region?.code) return null;
    return {
      bjdCode: region.code as string,           // 10자리 법정동코드
      lawdCd: (region.code as string).slice(0, 5), // 앞 5자리 = 시군구 코드
    };
  } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    const { limit = 10 } = await req.json().catch(() => ({ limit: 10 }));

    const { data: zones, error } = await supabase
      .from("gyeonggi_zones")
      .select("zone_id, imprv_zone_nm, sigun_nm, locplc_addr, biz_step_nm")
      .or("lat.is.null,lng.is.null")
      .not("zone_id", "is", null)
      .not("biz_step_nm", "in", '("준공","이전고시","청산")')
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!KAKAO_REST_KEY) return NextResponse.json({ error: "KAKAO_REST_API_KEY 환경변수가 없습니다. Vercel 설정을 확인하세요." }, { status: 500 });
    if (!zones?.length) return NextResponse.json({ done: true, success: 0, failed: 0, remaining: 0 });

    let success = 0;
    let failed = 0;
    const failedZones: { zone_id: string; name: string; sigun: string; addr: string; step: string }[] = [];

    for (const zone of zones) {
      const primary  = zone.locplc_addr?.trim().replace(/(일원|일대|외)\s*$/, "").trim() || null;
      const fallback = [zone.sigun_nm, zone.imprv_zone_nm].filter(Boolean).join(" ");
      if (!fallback) {
        failed++;
        failedZones.push({ zone_id: zone.zone_id!, name: zone.imprv_zone_nm ?? "", sigun: zone.sigun_nm ?? "", addr: zone.locplc_addr ?? "", step: zone.biz_step_nm ?? "" });
        continue;
      }

      const coords = await geocodeWithFallbacks(primary, fallback);

      if (!coords) {
        failed++;
        failedZones.push({ zone_id: zone.zone_id!, name: zone.imprv_zone_nm ?? "", sigun: zone.sigun_nm ?? "", addr: zone.locplc_addr ?? "", step: zone.biz_step_nm ?? "" });
        continue;
      }

      await new Promise(r => setTimeout(r, 80));

      // 역지오코딩으로 bjd_code·lawd_cd 취득
      const geo = await reverseGeocode(coords.lat, coords.lng);

      const updatePayload: Record<string, unknown> = { lat: coords.lat, lng: coords.lng };
      if (geo) {
        updatePayload.bjd_code = geo.bjdCode;
        updatePayload.lawd_cd  = geo.lawdCd;
      }

      const { error: upErr } = await supabase
        .from("gyeonggi_zones")
        .update(updatePayload)
        .eq("zone_id", zone.zone_id);

      if (upErr) { failed++; failedZones.push({ zone_id: zone.zone_id!, name: zone.imprv_zone_nm ?? "", sigun: zone.sigun_nm ?? "", addr: zone.locplc_addr ?? "", step: zone.biz_step_nm ?? "" }); }
      else { success++; }
    }

    const { count } = await supabase
      .from("gyeonggi_zones")
      .select("zone_id", { count: "exact", head: true })
      .or("lat.is.null,lng.is.null")
      .not("zone_id", "is", null);

    return NextResponse.json({ done: (count ?? 0) === 0, success, failed, remaining: count ?? 0, failedZones });
  } catch (e) {
    return NextResponse.json({ error: `서버 오류: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

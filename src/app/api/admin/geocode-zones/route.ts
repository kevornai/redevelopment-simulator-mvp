/**
 * 좌표 없는 구역 일괄 지오코딩 API
 * POST /api/admin/geocode-zones
 * gyeonggi_zones에서 lat/lng NULL인 구역을 찾아 카카오 REST API로 좌표 채움
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

async function geocodeWithFallbacks(primary: string | null, zoneName: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY) return null;
  try {
    // 1. 주소 검색 (locplc_addr)
    if (primary) {
      const r = await searchAddress(primary);
      if (r) return r;
      // 숫자로 끝나는 주소 → "번지" 붙여서 재시도
      const withBunji = primary.replace(/(\d+)\s*$/, "$1번지");
      if (withBunji !== primary) {
        const r2 = await searchAddress(withBunji);
        if (r2) return r2;
      }
    }
    // 2. 구역명 키워드 검색 (괄호 제거)
    const cleanName = zoneName.replace(/\([^)]*\)/g, "").trim();
    const r3 = await searchKeyword(cleanName);
    if (r3) return r3;
    // 3. 원본 구역명 그대로
    if (cleanName !== zoneName) {
      const r4 = await searchKeyword(zoneName);
      if (r4) return r4;
    }
    return null;
  } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    const { limit = 10 } = await req.json().catch(() => ({ limit: 10 }));

    const { data: zones, error } = await supabase
      .from("gyeonggi_zones")
      .select("zone_id, imprv_zone_nm, sigun_nm, locplc_addr")
      .or("lat.is.null,lng.is.null")
      .not("zone_id", "is", null)
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!zones?.length) return NextResponse.json({ done: true, success: 0, failed: 0, remaining: 0 });

    let success = 0;
    let failed = 0;

    for (const zone of zones) {
      const primary  = zone.locplc_addr?.trim().replace(/\s*(일원|일대|외)\s*$/, "") || null;
      const fallback = [zone.sigun_nm, zone.imprv_zone_nm].filter(Boolean).join(" ");
      if (!fallback) { failed++; continue; }

      const coords = await geocodeWithFallbacks(primary, fallback);

      if (!coords) { failed++; continue; }

      const { error: upErr } = await supabase
        .from("gyeonggi_zones")
        .update({ lat: coords.lat, lng: coords.lng })
        .eq("zone_id", zone.zone_id);

      if (upErr) { failed++; } else { success++; }
    }

    const { count } = await supabase
      .from("gyeonggi_zones")
      .select("zone_id", { count: "exact", head: true })
      .or("lat.is.null,lng.is.null")
      .not("zone_id", "is", null);

    return NextResponse.json({ done: (count ?? 0) === 0, success, failed, remaining: count ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: `서버 오류: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}

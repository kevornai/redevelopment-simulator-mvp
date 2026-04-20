/**
 * 좌표 없는 구역 일괄 지오코딩 API
 * POST /api/admin/geocode-zones
 * gyeonggi_zones에서 lat/lng NULL인 구역을 찾아 카카오 REST API로 좌표 채움
 * 우선순위: locplc_addr(실제주소) → sigun_nm + imprv_zone_nm(구역명)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY || !query) return null;
  try {
    // 1차: 주소 검색
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(4000) }
    );
    const json = await res.json();
    const doc = json.documents?.[0];
    if (doc) return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };

    // 2차: 키워드 검색 (주소 검색 실패 시)
    const res2 = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(4000) }
    );
    const json2 = await res2.json();
    const doc2 = json2.documents?.[0];
    if (doc2) return { lat: parseFloat(doc2.y), lng: parseFloat(doc2.x) };

    return null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const supabase = createAdminClient();

  const { limit = 20 } = await req.json().catch(() => ({ limit: 20 }));

  // lat/lng 없는 구역 조회 — locplc_addr 포함
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
    // locplc_addr 우선, 없으면 "시군명 구역명"
    const primary   = zone.locplc_addr?.trim() || null;
    const fallback  = [zone.sigun_nm, zone.imprv_zone_nm].filter(Boolean).join(" ");
    const query     = primary || fallback;

    if (!query) { failed++; continue; }

    const coords = await geocode(query);

    if (!coords && primary) {
      // 주소로 실패 시 구역명으로 재시도
      const coords2 = await geocode(fallback);
      if (coords2) {
        const { error: upErr } = await supabase
          .from("gyeonggi_zones")
          .update({ lat: coords2.lat, lng: coords2.lng })
          .eq("zone_id", zone.zone_id);
        if (upErr) { failed++; } else { success++; }
        continue;
      }
    }

    if (!coords) {
      // 찾지 못해도 null 대신 시군 중심 좌표라도 넣어 루프 무한반복 방지
      // zone_id NULL이 아닌 것에만 0,0 marker 삽입 (나중에 수동 수정 가능)
      failed++;
      continue;
    }

    const { error: upErr } = await supabase
      .from("gyeonggi_zones")
      .update({ lat: coords.lat, lng: coords.lng })
      .eq("zone_id", zone.zone_id);

    if (upErr) { failed++; } else { success++; }
  }

  // 남은 개수 확인
  const { count } = await supabase
    .from("gyeonggi_zones")
    .select("zone_id", { count: "exact", head: true })
    .or("lat.is.null,lng.is.null")
    .not("zone_id", "is", null);

  return NextResponse.json({ done: (count ?? 0) === 0, success, failed, remaining: count ?? 0 });
}

/**
 * 좌표 없는 구역 일괄 지오코딩 API
 * POST /api/admin/geocode-zones
 * zones_data에서 lat/lng NULL인 구역을 찾아 카카오 REST API로 좌표 채움
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY || !address) return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(5000) }
    );
    const json = await res.json();
    const doc = json.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch { return null; }
}

export async function POST() {
  const supabase = createAdminClient();

  // lat/lng 없는 구역 조회 (zone_name과 sigungu 포함)
  const { data: zones, error } = await supabase
    .from("zones_data")
    .select("zone_id, zone_name, sigungu")
    .or("lat.is.null,lng.is.null");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!zones?.length) return NextResponse.json({ message: "좌표 없는 구역이 없습니다.", count: 0 });

  let success = 0;
  let failed = 0;

  for (const zone of zones) {
    // 검색어: "시군 구역명" 조합
    const query = [zone.sigungu, zone.zone_name].filter(Boolean).join(" ");
    if (!query) { failed++; continue; }

    const coords = await geocode(query);
    if (!coords) { failed++; continue; }

    const { error: upErr } = await supabase
      .from("zones_data")
      .update({ lat: coords.lat, lng: coords.lng })
      .eq("zone_id", zone.zone_id);

    if (upErr) { failed++; } else { success++; }
  }

  return NextResponse.json({ success, failed, total: zones.length });
}

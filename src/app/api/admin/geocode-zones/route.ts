/**
 * 좌표 없는 구역 일괄 지오코딩 API
 * POST /api/admin/geocode-zones
 * zones에서 lat/lng NULL인 구역을 찾아 카카오 REST API로 좌표 채움
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

export async function POST(req: Request) {
  const supabase = createAdminClient();

  // 한 번에 처리할 배치 크기 (Vercel 10s 타임아웃 고려 — 건당 ~200ms)
  const { limit = 30 } = await req.json().catch(() => ({ limit: 30 }));

  // lat/lng 없는 구역 조회
  const { data: zones, error } = await supabase
    .from("gyeonggi_zones")
    .select("zone_id, imprv_zone_nm, sigun_nm")
    .or("lat.is.null,lng.is.null")
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!zones?.length) return NextResponse.json({ done: true, success: 0, remaining: 0 });

  let success = 0;
  let failed = 0;

  for (const zone of zones) {
    const query = [zone.sigun_nm, zone.imprv_zone_nm].filter(Boolean).join(" ");
    if (!query) { failed++; continue; }

    const coords = await geocode(query);
    if (!coords) { failed++; continue; }

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
    .or("lat.is.null,lng.is.null");

  return NextResponse.json({ done: (count ?? 0) === 0, success, failed, remaining: count ?? 0 });
}

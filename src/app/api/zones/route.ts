/**
 * 공개 구역 목록 API
 * GET /api/zones
 * 지도에 표시할 구역 목록 반환 (lat/lng 있는 것만)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300; // 5분 캐시

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyeonggi_zones")
    .select("zone_id, imprv_zone_nm, biz_type_nm, strcontr_date, manage_disposit_confmtn_date, biz_implmtn_confmtn_date, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .not("zone_id", "is", null)
    .order("zone_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  function inferStage(z: { strcontr_date?: string | null; manage_disposit_confmtn_date?: string | null; biz_implmtn_confmtn_date?: string | null }) {
    if (z.strcontr_date) return "construction_start";
    if (z.manage_disposit_confmtn_date) return "management_disposal";
    if (z.biz_implmtn_confmtn_date) return "project_implementation";
    return "zone_designation";
  }

  const zones = (data ?? []).map((z) => ({
    zone_id: z.zone_id,
    zone_name: z.imprv_zone_nm,
    project_type: z.biz_type_nm === "재건축" ? "reconstruction" : "redevelopment",
    project_stage: inferStage(z),
    lat: z.lat,
    lng: z.lng,
  }));

  return NextResponse.json({ zones });
}

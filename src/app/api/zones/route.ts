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
    .from("zones")
    .select("zone_id, zone_name, project_type, project_stage, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("zone_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ zones: data ?? [] });
}

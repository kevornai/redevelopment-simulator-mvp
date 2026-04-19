/**
 * 구역 데이터 단일 진실 공급원 (Single Source of Truth)
 * zones.ts / zone-coords.ts 대체 — 모든 구역 정보는 zones 테이블에서 읽음
 *
 * 서버 컴포넌트 / Server Action / API Route에서 사용
 */

import { createClient } from "@/lib/supabase/server";

export interface ZoneBasic {
  zone_id: string;
  zone_name: string;
  project_type: "reconstruction" | "redevelopment";
  project_stage: string;
  lat: number | null;
  lng: number | null;
  lawd_cd: string | null;
}

/** 전체 구역 목록 (이름 + 타입 + 단계) */
export async function getAllZones(): Promise<ZoneBasic[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("zones")
    .select("zone_id, zone_name, project_type, project_stage, lat, lng, lawd_cd")
    .order("project_type", { ascending: false }) // reconstruction 먼저
    .order("zone_name");
  return (data ?? []).map((z) => ({
    ...z,
    zone_name: z.zone_name ?? z.zone_id,
  }));
}

/** zone_id → zone_name 맵 (계산 엔진, SEO 등에서 사용) */
export async function getZoneNameMap(): Promise<Record<string, string>> {
  const zones = await getAllZones();
  return Object.fromEntries(zones.map((z) => [z.zone_id, z.zone_name]));
}

/** 단일 구역 이름 조회 */
export async function getZoneName(zoneId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("zones")
    .select("zone_name")
    .eq("zone_id", zoneId)
    .single();
  return data?.zone_name ?? null;
}

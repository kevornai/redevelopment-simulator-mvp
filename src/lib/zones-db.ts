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

function inferStage(z: {
  strcontr_date: string | null;
  manage_disposit_confmtn_date: string | null;
  biz_implmtn_confmtn_date: string | null;
}): string {
  if (z.strcontr_date)                    return "construction_start";
  if (z.manage_disposit_confmtn_date)     return "management_disposal";
  if (z.biz_implmtn_confmtn_date)         return "project_implementation";
  return "zone_designation";
}

export async function getAllZones(): Promise<ZoneBasic[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyeonggi_zones")
    .select("zone_id, imprv_zone_nm, biz_type_nm, sigun_nm, lat, lng, lawd_cd, strcontr_date, manage_disposit_confmtn_date, biz_implmtn_confmtn_date")
    .not("zone_id", "is", null)
    .order("sigun_nm");
  return (data ?? []).map((z) => ({
    zone_id:      z.zone_id!,
    zone_name:    z.imprv_zone_nm ?? z.zone_id,
    project_type: z.biz_type_nm === "재건축" ? "reconstruction" : "redevelopment",
    project_stage: inferStage(z),
    lat:          z.lat ?? null,
    lng:          z.lng ?? null,
    lawd_cd:      z.lawd_cd ?? null,
  }));
}

export async function getZoneNameMap(): Promise<Record<string, string>> {
  const zones = await getAllZones();
  return Object.fromEntries(zones.map((z) => [z.zone_id, z.zone_name]));
}

export async function getZoneName(zoneId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyeonggi_zones")
    .select("imprv_zone_nm")
    .eq("zone_id", zoneId)
    .single();
  return data?.imprv_zone_nm ?? null;
}

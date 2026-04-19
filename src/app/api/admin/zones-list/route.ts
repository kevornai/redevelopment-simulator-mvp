import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gyeonggi_zones")
    .select("zone_id, imprv_zone_nm, biz_type_nm, lawd_cd, lat, lng, zone_ar, member_lotout_hshld_cnt, new_far, synced_at, strcontr_date, manage_disposit_confmtn_date, biz_implmtn_confmtn_date")
    .not("zone_id", "is", null)
    .order("biz_type_nm", { ascending: false })
    .order("imprv_zone_nm");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
    lawd_cd: z.lawd_cd,
    lat: z.lat,
    lng: z.lng,
    zone_area_sqm: z.zone_ar,
    planned_units_member: z.member_lotout_hshld_cnt,
    floor_area_ratio_new: z.new_far ? parseFloat(z.new_far) : null,
    updated_at: z.synced_at,
  }));

  return NextResponse.json({ zones });
}

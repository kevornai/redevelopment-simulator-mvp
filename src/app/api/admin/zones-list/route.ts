import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zones")
    .select("zone_id, zone_name, project_type, project_stage, lawd_cd, lat, lng, p_base, member_sale_price_per_pyung, total_appraisal_value, updated_at, zone_area_sqm, planned_units_member, floor_area_ratio_new, public_contribution_ratio, incentive_far_bonus, member_avg_pyung, efficiency_ratio")
    .order("project_type", { ascending: false })
    .order("zone_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
}

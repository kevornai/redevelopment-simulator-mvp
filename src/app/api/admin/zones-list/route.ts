import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zones_data")
    .select("zone_id, zone_name, project_type, project_stage, lawd_cd, lat, lng, p_base, member_sale_price_per_pyung, total_appraisal_value, updated_at")
    .order("project_type", { ascending: false })
    .order("zone_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
}

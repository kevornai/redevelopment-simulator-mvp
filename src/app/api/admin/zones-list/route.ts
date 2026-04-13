import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

export async function GET(req: NextRequest) {
  if (ADMIN_SECRET && req.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zones_data")
    .select("zone_id, zone_name, project_type, project_stage, lawd_cd, lat, lng, p_base, member_sale_price_per_pyung, total_appraisal_value, updated_at")
    .order("project_type", { ascending: false })
    .order("zone_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data ?? [] });
}

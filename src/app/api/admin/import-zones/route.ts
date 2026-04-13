/**
 * 관리자 전용 구역 일괄 임포트 API
 * POST /api/admin/import-zones
 *
 * body: { zones: ParsedRow[] }
 * 이미 존재하는 zone_id는 project_stage / project_type / lawd_cd만 업데이트
 * 신규 zone_id는 기본값으로 INSERT (계산 가능한 최소 구조)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

// 신규 구역 INSERT 시 기본값 (서울 재개발 기준)
const DEFAULT_ROW = {
  avg_appraisal_rate: 1.3,
  base_project_months: 72,
  t_admin_remaining: 12,
  delay_conflict: 24,
  months_to_construction_start: 24,
  current_construction_cost: 9500000,
  r_recent: 0.007,
  r_long: 0.002,
  decay_factor: 0.04,
  alpha: 0.002,
  p_base: 70000000,
  peak_local: 100000000,
  mdd_local: 0.22,
  member_sale_price_per_pyung: 55000000,
  member_sale_price_source: "cost_estimated",
  neighbor_new_apt_price: 2000000000,
  pf_loan_ratio: 0.5,
  annual_pf_rate: 0.065,
  total_floor_area: 200000,
  total_appraisal_value: 3000000000000,
  general_sale_area: 70000,
  member_sale_area: 130000,
  holding_loan_ratio: 0.6,
  annual_holding_rate: 0.042,
  reconstruction_safety_passed: true,
  existing_apt_pyung: null,
  acquisition_tax_rate: 0.028,
  move_out_cost: 5000000,
  target_yield_rate: 0.08,
  contribution_at_construction: 0.5,
  construction_start_announced_ym: null,
};

interface ZoneInput {
  zoneId: string;
  name: string;
  gu: string;
  projectType: string;
  projectStage: string;
  lawdCd: string;
}

export async function POST(req: NextRequest) {
  if (ADMIN_SECRET) {
    const auth = req.headers.get("x-admin-secret");
    if (auth !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json();
  const zones: ZoneInput[] = body.zones ?? [];

  if (!zones.length) {
    return NextResponse.json({ error: "zones 배열이 비어있습니다." }, { status: 400 });
  }

  const supabase = await createClient();

  // 기존 zone_id 조회
  const { data: existing } = await supabase
    .from("zones_data")
    .select("zone_id")
    .in("zone_id", zones.map((z) => z.zoneId));

  const existingIds = new Set((existing ?? []).map((r: { zone_id: string }) => r.zone_id));

  let upserted = 0;
  let skipped = 0;

  for (const zone of zones) {
    if (!zone.zoneId) { skipped++; continue; }

    if (existingIds.has(zone.zoneId)) {
      // 기존: stage / type / lawd_cd만 업데이트
      const { error } = await supabase
        .from("zones_data")
        .update({
          project_stage: zone.projectStage,
          project_type: zone.projectType,
          lawd_cd: zone.lawdCd || null,
          updated_at: new Date().toISOString(),
        })
        .eq("zone_id", zone.zoneId);

      if (!error) upserted++;
      else skipped++;
    } else {
      // 신규: 기본값 + 입력값으로 INSERT
      const { error } = await supabase
        .from("zones_data")
        .insert({
          ...DEFAULT_ROW,
          zone_id: zone.zoneId,
          project_type: zone.projectType,
          project_stage: zone.projectStage,
          lawd_cd: zone.lawdCd || null,
          // 재건축이면 감정평가율 낮춤
          avg_appraisal_rate: zone.projectType === "reconstruction" ? 1.05 : 1.3,
        });

      if (!error) upserted++;
      else { console.error(error); skipped++; }
    }
  }

  return NextResponse.json({ upserted, skipped, total: zones.length });
}

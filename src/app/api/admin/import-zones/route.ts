/**
 * 관리자 전용 구역 일괄 임포트 API
 * POST /api/admin/import-zones
 * 배치 upsert + 병렬 지오코딩 (주소 → 좌표 즉시 반영)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

interface GeoResult {
  lat: number;
  lng: number;
  bjdCode: string | null; // 법정동코드 10자리
}

async function geocode(address: string): Promise<GeoResult | null> {
  if (!KAKAO_REST_KEY || !address.trim()) return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(3000) }
    );
    const json = await res.json();
    const doc = json.documents?.[0];
    if (!doc) return null;
    // b_code: 법정동코드 10자리 (address 객체에 있음)
    const bjdCode: string | null = doc.address?.b_code ?? doc.road_address?.x ?? null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x), bjdCode };
  } catch { return null; }
}

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
  region: string;
  address: string;
  projectType: string;
  projectStage: string;
  lawdCd: string;
  zone_area_sqm?: number | null;
  existing_building_year?: number | null;
  existing_units_total?: number | null;
  planned_units_total?: number | null;
  planned_units_member?: number | null;
  planned_units_general?: number | null;
  planned_units_rent?: number | null;
  new_units_sale_total?: number | null;
  new_units_sale_u40?: number | null;
  new_units_sale_40_60?: number | null;
  new_units_sale_60_85?: number | null;
  new_units_sale_85_135?: number | null;
  new_units_sale_o135?: number | null;
  new_units_rent_total?: number | null;
  floor_area_ratio_existing?: number | null;
  floor_area_ratio_new?: number | null;
  land_owners_count?: number | null;
  association_members_count?: number | null;
  project_period_start?: string | null;
  project_period_end?: string | null;
  basic_plan_date?: string | null;
  zone_designation_date?: string | null;
  zone_designation_change_date?: string | null;
  promotion_committee_date?: string | null;
  safety_inspection_grade?: string | null;
  association_approval_date?: string | null;
  project_implementation_date?: string | null;
  management_disposal_date?: string | null;
  construction_start_date?: string | null;
  general_sale_date?: string | null;
  completion_date?: string | null;
  project_operator?: string | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const zones: ZoneInput[] = (body.zones ?? []).filter((z: ZoneInput) => z.zoneId);

  if (!zones.length) {
    return NextResponse.json({ error: "zones 배열이 비어있습니다." }, { status: 400 });
  }

  // 주소 → 좌표 병렬 지오코딩 (50개씩 묶어서)
  const coordMap = new Map<string, GeoResult | null>();
  const GEO_BATCH = 50;
  for (let i = 0; i < zones.length; i += GEO_BATCH) {
    const batch = zones.slice(i, i + GEO_BATCH);
    const results = await Promise.allSettled(
      batch.map((z) => geocode(z.address))
    );
    results.forEach((r, idx) => {
      const zoneId = batch[idx].zoneId;
      coordMap.set(zoneId, r.status === "fulfilled" ? r.value : null);
    });
  }

  const supabase = createAdminClient();

  const records = zones.map((zone) => {
    const coords = coordMap.get(zone.zoneId);
    return {
      ...DEFAULT_ROW,
      zone_id: zone.zoneId,
      zone_name: zone.name,
      sigungu: zone.region || null,
      project_type: zone.projectType,
      project_stage: zone.projectStage,
      lawd_cd: zone.lawdCd || null,
      avg_appraisal_rate: zone.projectType === "reconstruction" ? 1.05 : 1.3,
      updated_at: new Date().toISOString(),
      // 좌표 + 법정동코드 (카카오 지오코딩)
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      bjd_code: coords?.bjdCode ?? null,
      // 상세 필드
      zone_area_sqm: zone.zone_area_sqm ?? null,
      existing_building_year: zone.existing_building_year ?? null,
      existing_units_total: zone.existing_units_total ?? null,
      planned_units_total: zone.planned_units_total ?? null,
      planned_units_member: zone.planned_units_member ?? null,
      planned_units_general: zone.planned_units_general ?? null,
      planned_units_rent: zone.planned_units_rent ?? null,
      new_units_sale_total: zone.new_units_sale_total ?? null,
      new_units_sale_u40: zone.new_units_sale_u40 ?? null,
      new_units_sale_40_60: zone.new_units_sale_40_60 ?? null,
      new_units_sale_60_85: zone.new_units_sale_60_85 ?? null,
      new_units_sale_85_135: zone.new_units_sale_85_135 ?? null,
      new_units_sale_o135: zone.new_units_sale_o135 ?? null,
      new_units_rent_total: zone.new_units_rent_total ?? null,
      floor_area_ratio_existing: zone.floor_area_ratio_existing ?? null,
      floor_area_ratio_new: zone.floor_area_ratio_new ?? null,
      land_owners_count: zone.land_owners_count ?? null,
      association_members_count: zone.association_members_count ?? null,
      project_period_start: zone.project_period_start ?? null,
      project_period_end: zone.project_period_end ?? null,
      basic_plan_date: zone.basic_plan_date ?? null,
      zone_designation_date: zone.zone_designation_date ?? null,
      zone_designation_change_date: zone.zone_designation_change_date ?? null,
      promotion_committee_date: zone.promotion_committee_date ?? null,
      safety_inspection_grade: zone.safety_inspection_grade ?? null,
      association_approval_date: zone.association_approval_date ?? null,
      project_implementation_date: zone.project_implementation_date ?? null,
      management_disposal_date: zone.management_disposal_date ?? null,
      construction_start_date: zone.construction_start_date ?? null,
      general_sale_date: zone.general_sale_date ?? null,
      completion_date: zone.completion_date ?? null,
      project_operator: zone.project_operator ?? null,
    };
  });

  // 100건씩 배치 upsert
  const BATCH = 100;
  let upserted = 0;
  let skipped = 0;
  const geocoded = [...coordMap.values()].filter(Boolean).length;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from("zones_data")
      .upsert(batch, { onConflict: "zone_id", ignoreDuplicates: false });

    if (error) {
      console.error("batch upsert error:", error);
      if (upserted === 0 && skipped === 0) {
        return NextResponse.json({ error: error.message, detail: error.details, hint: error.hint, code: error.code }, { status: 500 });
      }
      skipped += batch.length;
    } else {
      upserted += batch.length;
    }
  }

  return NextResponse.json({ upserted, skipped, geocoded, total: zones.length });
}

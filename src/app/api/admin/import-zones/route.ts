/**
 * 관리자 전용 구역 일괄 임포트 API
 * POST /api/admin/import-zones
 * 신규: 카카오 REST API 지오코딩으로 대표지번 → lat/lng 자동 변환
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

// 신규 구역 INSERT 시 기본값
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
  // 경기도 상세 필드 (optional)
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

/** 카카오 지오코딩: 주소 → lat/lng */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY || !address) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent("서울 " + address)}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const doc = json.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const zones: ZoneInput[] = body.zones ?? [];

  if (!zones.length) {
    return NextResponse.json({ error: "zones 배열이 비어있습니다." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("zones_data")
    .select("zone_id, lat, lng")
    .in("zone_id", zones.map((z) => z.zoneId));

  const existingMap = new Map(
    (existing ?? []).map((r: { zone_id: string; lat: number | null; lng: number | null }) => [r.zone_id, r])
  );

  let upserted = 0;
  let skipped = 0;

  for (const zone of zones) {
    if (!zone.zoneId) { skipped++; continue; }

    // 좌표 지오코딩 (기존에 없을 때만)
    const ex = existingMap.get(zone.zoneId);
    let coords: { lat: number; lng: number } | null = null;
    if (!ex?.lat && zone.address) {
      coords = await geocode(zone.address);
    }

    // 경기도 상세 필드 공통 패치
    const detailPatch: Record<string, unknown> = {
      sigungu: zone.region || null,
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

    if (ex) {
      // 기존 구역: stage / type / lawd_cd + 좌표(없으면) + 상세 업데이트
      const patch: Record<string, unknown> = {
        project_stage: zone.projectStage,
        project_type: zone.projectType,
        lawd_cd: zone.lawdCd || null,
        zone_name: zone.name,
        updated_at: new Date().toISOString(),
        ...detailPatch,
      };
      if (coords) { patch.lat = coords.lat; patch.lng = coords.lng; }

      const { error } = await supabase
        .from("zones_data")
        .update(patch)
        .eq("zone_id", zone.zoneId);

      if (!error) upserted++;
      else { console.error(zone.zoneId, error); skipped++; }
    } else {
      // 신규 INSERT
      const { error } = await supabase
        .from("zones_data")
        .insert({
          ...DEFAULT_ROW,
          ...detailPatch,
          zone_id: zone.zoneId,
          zone_name: zone.name,
          project_type: zone.projectType,
          project_stage: zone.projectStage,
          lawd_cd: zone.lawdCd || null,
          avg_appraisal_rate: zone.projectType === "reconstruction" ? 1.05 : 1.3,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });

      if (!error) upserted++;
      else { console.error(zone.zoneId, error); skipped++; }
    }

    // 지오코딩 rate limit 방지
    if (coords) await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ upserted, skipped, total: zones.length });
}

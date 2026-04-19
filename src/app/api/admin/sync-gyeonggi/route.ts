import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GyeonggiRow = {
  SIGUN_NM: string;
  SIGUN_CD: string;
  BIZ_TYPE_NM: string;
  IMPRV_ZONE_NM: string;
  IMPRV_ZONE_APPONT_FIRST_DE: string | null;
  PROPLSN_COMMISN_APRV_DE: string | null;
  ASSOCTN_FOUND_CONFMTN_DE: string | null;
  BIZ_IMPLMTN_CONFMTN_DE: string | null;
  MANAGE_DISPOSIT_CONFMTN_DE: string | null;
  STRCONTR_DE: string | null;
  GENRL_LOTOUT_DE: string | null;
  COMPLTN_DE: string | null;
};

/** 경기도 API 원본 이름 → zone_id 생성
 *  "수원시", "권선 2구역(성일아파트)" → "수원시_권선2구역"
 */
function makeZoneId(sigungu: string, rawName: string): string {
  const city = sigungu.split(/\s/)[0];
  const name = rawName
    .replace(/\s+/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/(아파트|주공아파트|주공|단지)$/, "");
  return `${city}_${name}`;
}

/** 날짜 문자열 정규화: YYYYMMDD → YYYY-MM-DD (이미 하이픈 형식이면 그대로) */
function normalizeDate(d: string | null): string | null {
  if (!d) return null;
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

/** 날짜 있는 개수 기준으로 현재 단계 추정 */
function inferStage(r: GyeonggiRow): string {
  if (r.STRCONTR_DE)              return "construction_start";
  if (r.MANAGE_DISPOSIT_CONFMTN_DE) return "management_disposal";
  if (r.BIZ_IMPLMTN_CONFMTN_DE)  return "project_implementation";
  if (r.ASSOCTN_FOUND_CONFMTN_DE) return "association_established";
  return "zone_designation";
}

// zones 테이블에 새 구역 삽입 시 사용하는 기본값
const ZONE_DEFAULTS = {
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
  peak_local: 100000000,
  mdd_local: 0.22,
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
  acquisition_tax_rate: 0.028,
  move_out_cost: 5000000,
  target_yield_rate: 0.08,
  contribution_at_construction: 0.5,
  p_base: 70000000,
  member_sale_price_per_pyung: 55000000,
};

export async function POST(req: NextRequest) {
  try {
    const rows: GyeonggiRow[] = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ saved: 0, inserted: 0, error: "rows가 비어있습니다." });
    }

    const supabase = await createClient();

    // api_source_id 중복 제거 (같은 배치 내)
    const deduped = Array.from(
      new Map(
        rows.map((r) => [
          `${r.SIGUN_CD}_${r.IMPRV_ZONE_NM.replace(/\s+/g, "_")}`,
          r,
        ])
      ).entries()
    ).map(([sourceId, r]) => ({ sourceId, row: r }));

    // 이미 연결된 zones 조회 (api_source_id 기준)
    const { data: existingZones } = await supabase
      .from("zones")
      .select("zone_id, api_source_id")
      .eq("api_source", "gyeonggi_api")
      .not("api_source_id", "is", null);

    const linkedMap = new Map(
      (existingZones ?? []).map((z: { zone_id: string; api_source_id: string }) => [
        z.api_source_id,
        z.zone_id,
      ])
    );

    let updated = 0;
    let inserted = 0;

    for (const { sourceId, row: r } of deduped) {
      const dates = {
        zone_designation_date:       normalizeDate(r.IMPRV_ZONE_APPONT_FIRST_DE),
        association_approval_date:   normalizeDate(r.ASSOCTN_FOUND_CONFMTN_DE),
        project_implementation_date: normalizeDate(r.BIZ_IMPLMTN_CONFMTN_DE),
        management_disposal_date:    normalizeDate(r.MANAGE_DISPOSIT_CONFMTN_DE),
        construction_start_date:     normalizeDate(r.STRCONTR_DE),
        general_sale_date:           normalizeDate(r.GENRL_LOTOUT_DE),
        completion_date:             normalizeDate(r.COMPLTN_DE),
      };

      if (linkedMap.has(sourceId)) {
        // 기존 연결된 구역 — 날짜만 갱신
        const { error } = await supabase
          .from("zones")
          .update({ ...dates, api_raw_name: r.IMPRV_ZONE_NM, updated_at: new Date().toISOString() })
          .eq("zone_id", linkedMap.get(sourceId)!);
        if (!error) updated++;
      } else {
        // 새 구역 삽입
        const zoneId = makeZoneId(r.SIGUN_NM, r.IMPRV_ZONE_NM);
        const projectType =
          r.BIZ_TYPE_NM === "재건축" ? "reconstruction"
          : r.BIZ_TYPE_NM === "재개발" ? "redevelopment"
          : null;
        if (!projectType) continue;

        const { error } = await supabase.from("zones").insert({
          ...ZONE_DEFAULTS,
          zone_id: zoneId,
          zone_name: r.IMPRV_ZONE_NM,
          api_raw_name: r.IMPRV_ZONE_NM,
          api_source: "gyeonggi_api",
          api_source_id: sourceId,
          sido: "경기도",
          sigungu: r.SIGUN_NM,
          project_type: projectType,
          project_stage: inferStage(r),
          avg_appraisal_rate: projectType === "reconstruction" ? 1.05 : 1.3,
          ...dates,
        });
        if (!error) inserted++;
      }
    }

    return NextResponse.json({ saved: deduped.length, updated, inserted });
  } catch (e) {
    console.error("[sync-gyeonggi] error:", e);
    return NextResponse.json(
      { saved: 0, updated: 0, inserted: 0, error: `서버 오류: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

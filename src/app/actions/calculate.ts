"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchMarketData } from "@/lib/market-data";
import type { MarketData } from "@/lib/market-data";
import { deriveMonthsToConstruction, deriveMemberSalePrice } from "@/lib/derive-zone-params";

// ═══════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════════════════════════════

export interface CalculationInput {
  zoneId: string;
  projectType: "redevelopment" | "reconstruction";
  propertyType: string;
  purchasePrice: number;       // 매수 희망가 (원)
  purchaseLoanAmount: number;  // 매수 시 대출금 (원)
  currentDeposit: number;      // 전/월세 보증금 (원)
  desiredPyung: number;        // 희망 조합원 분양 평형 (평)
  officialValuation: number;   // 공동주택 공시가격 (원) — 0이면 NSDI 자동조회
  landShareSqm: number;        // 대지지분 (㎡) — 등기부등본 표제부

  // ── 관리자 override — 입력 시 DB값보다 우선 ──────────────────
  admin?: {
    // 사업성 핵심값 (관리처분계획서/사업시행계획서 기준)
    totalAppraisalValue?: number;       // 총종전자산 감정평가액 (원)
    totalFloorArea?: number;            // 계획 총연면적 (㎡)
    generalSaleArea?: number;           // 일반분양 면적 (㎡) — 없으면 0
    memberSaleArea?: number;            // 조합원분양 면적 (㎡)
    memberSalePricePerPyung?: number;   // 조합원 분양가 (원/평) — 분양공고문
    // 시세 참고값
    neighborNewAptPrice?: number;       // 인근 신축 현재 시세 (원, 희망평형 기준)
    generalSalePricePerPyung?: number;  // 예상 일반분양가 (원/평)
    // 대지지분 기반 감정평가 (등기부등본+토지대장)
    landOfficialPricePerSqm?: number;   // 개별공시지가 (원/㎡) — 토지대장
    // 사업 일정
    constructionStartYm?: string;       // 착공예정월 (YYYYMM) — 조합 공문
  };
}

/** 사업 단계별 현금흐름 스냅샷 */
export interface StageCashFlow {
  stage: string;
  label: string;
  monthFromNow: number;        // 현재 시점부터 경과 개월
  cumulativeCashOut: number;   // 누적 현금 지출 (원)
  cumulativeCashIn: number;    // 누적 현금 수입 (이주비 등)
  netCashPosition: number;     // 순 현금 포지션
}

/** 시나리오별 완전 결과 */
export interface ScenarioResult {
  scenarioType: "optimistic" | "neutral" | "pessimistic";
  scenarioLabel: string;

  // ── 사업 기간 ──
  appliedMonths: number;
  monthsToConstructionStart: number;
  constructionPeriodMonths: number;
  monthsToConstructionSource: "announced" | "statistical" | "db_override";

  // ── 공사비 ──
  appliedConstructionCostPerPyung: number; // 최종 적용 평당 공사비
  constructionCostGrowthRate: number;      // 적용된 월 인상률 (%)

  // ── 분양가 ──
  appliedGeneralSalePrice: number; // 적용 평당 일반분양가
  memberSalePriceSource: "announced" | "manual" | "cost_estimated";

  // ── 감정평가 & 비례율 ──
  estimatedAppraisalValue: number;  // 예상 감정평가액
  appraisalMethod: "land_based" | "official_rate" | "purchase_based"; // 감정평가 계산 방식
  proportionalRate: number;         // 비례율 (%)
  rightsValue: number;              // 권리가액

  // ── 프리미엄 분석 ──
  estimatedPremium: number;         // 프리미엄 (매수가 - 감정평가액)
  premiumBubbleIndex: number;       // 프리미엄 버블지수 (%)
  premiumRecoveryYears: number;     // 프리미엄 회수 소요 연수 (추정)

  // ── 분담금 ──
  targetMemberSalePrice: number;    // 희망 평형 분양가 총액
  additionalContribution: number;   // 추가 분담금 (음수=환급)
  contributionAtConstruction: number; // 착공 시 납부액
  contributionAtCompletion: number;   // 입주 시 납부액

  // ── 비용 항목 ──
  acquisitionTax: number;           // 취득세 (추정)
  holdingInterestCost: number;      // 보유기간 이자 비용 (대출 이자)
  moveOutCost: number;              // 이사/명도 비용
  totalAdditionalCosts: number;     // 총 부대 비용

  // ── 투자 원금 및 수익 ──
  totalInvestmentCost: number;      // 총 투자 원금 (매수+분담금)
  totalInvestmentWithCosts: number; // 총 실투자 비용 (부대비용 포함)
  actualInitialInvestment: number;  // 초기 실투자금 (매수가 - 보증금)
  effectiveCash: number;            // 실제 현금 투입 (대출 제외)
  netProfit: number;                // 순수익 (시세차익)
  netProfitAfterCosts: number;      // 부대비용 차감 후 순수익

  // ── 수익률 ──
  returnOnEquity: number;           // ROE (초기 실투자금 기준, %)
  returnOnTotalInvestment: number;  // ROI (총 투자비용 기준, %)
  annualizedReturn: number;         // 연환산 수익률 (%)
  irr: number;                      // 내부수익률 IRR (%)
  npv: number;                      // 순현재가치 NPV (원, 할인율=목표수익률)

  // ── 리스크 지표 ──
  breakEvenGeneralSalePrice: number;  // 손익분기 일반분양가 (평당)
  maxAffordableContribution: number;  // 최대 감당 가능 분담금
  opportunityCostGap: number;         // 기회비용 대비 초과/미달 수익 (원)

  // ── 단계별 현금흐름 ──
  stageCashFlows: StageCashFlow[];
}

export interface CalculationResult {
  zoneId: string;
  zoneName: string;
  projectType: "redevelopment" | "reconstruction";
  projectStage: string;
  input: CalculationInput;
  optimistic: ScenarioResult;
  neutral: ScenarioResult;
  pessimistic: ScenarioResult;
  marketDataSources: {
    ratesFromApi: boolean;
    constructionCostFromApi: boolean;
    localPriceFromApi: boolean;
    publicPriceFromApi: boolean;
    nearbyNewAptFromApi: boolean;
    fetchedAt: string;
  };
  /** 계산에 실제 투입된 값 — 디버그용 */
  debugParams: {
    lawd_cd: string | null;
    bjd_code: string | null;
    effectiveLawdCd: string | null;
    existingUnits: number;
    plannedUnitsMember: number | null;
    total_appraisal_value: number;
    total_floor_area: number;
    member_sale_area: number;
    general_sale_area: number;
    p_base: number;
    member_sale_price_per_pyung: number;
    peak_local: number;
    neighbor_new_apt_price: number;
    nearbyOk: boolean;
    molitOk: boolean;
    buildingFloorAreaFromApi: boolean;
    buildingFloorAreaRaw: number | null;
    buildingFloorAreaFAR: number | null;
    projectStageRank: number;
    saleAreaSource: "calculated" | "db" | "missing";
    missingSaleAreaFields: string[];  // 계산 불가 시 누락된 필드 목록
  };
  /** 비정상 값 감지 시 경고 메시지 (결과는 유지) */
  warnings: string[];
  calculatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DB 타입
// ═══════════════════════════════════════════════════════════════════════════════

interface ZoneData {
  zone_id: string;
  project_type: "redevelopment" | "reconstruction";
  project_stage: string;
  avg_appraisal_rate: number;
  base_project_months: number;
  t_admin_remaining: number;
  delay_conflict: number;
  months_to_construction_start: number;
  current_construction_cost: number;
  r_recent: number;
  r_long: number;
  decay_factor: number;
  alpha: number;
  p_base: number;
  peak_local: number;
  mdd_local: number;
  member_sale_price_per_pyung: number;
  neighbor_new_apt_price: number;
  pf_loan_ratio: number;
  annual_pf_rate: number;
  total_floor_area: number;
  total_appraisal_value: number;
  general_sale_area: number;
  member_sale_area: number;
  holding_loan_ratio: number;
  annual_holding_rate: number;
  acquisition_tax_rate: number;
  move_out_cost: number;
  target_yield_rate: number;
  contribution_at_construction: number;
  existing_apt_pyung: number | null;
  lawd_cd: string | null;
  bjd_code: string | null;             // 법정동코드 10자리 — NSDI 공시가격 조회
  land_official_price_per_sqm: number | null;
  construction_start_announced_ym: string | null;
  member_sale_price_source: "cost_estimated" | "announced" | "manual";
  zone_name: string | null;
  // 0013 migration — Excel 임포트 데이터
  zone_area_sqm: number | null;
  existing_units_total: number | null;
  planned_units_total: number | null;
  planned_units_member: number | null;
  planned_units_general: number | null;
  floor_area_ratio_new: number | null;
  lat: number | null;
  lng: number | null;
  public_contribution_ratio: number | null;  // 기부체납률 (0~1)
  incentive_far_bonus: number | null;        // 인센티브 추가 용적률
  member_avg_pyung: number | null;           // 조합원 평균 분양 평형 (㎡)
  efficiency_ratio: number | null;           // 전용면적 효율 (0~1)
}

// ─── 단계 순서 (낮을수록 초기 단계) ───────────────────────────────────────────
const STAGE_RANK: Record<string, number> = {
  zone_designation: 1, basic_plan: 2,
  project_implementation: 3, management_disposal: 4,
  relocation: 5, construction_start: 6, completion: 7,
};
function stageRank(stage: string): number {
  return STAGE_RANK[stage] ?? 0;
}

/**
 * 사업 단계 미도달 항목을 DB 플레이스홀더 대신 추정값으로 대체.
 *
 * 핵심 원칙: B섹션(면적)과 C섹션(종전자산)은 반드시 같은 스케일에서 추정.
 * → 세대수(existingUnits) 기반으로 통일. 세대수 없으면 아무것도 추정 안 함.
 *
 * 단가(p_base, 조합원분양가)는 MOLIT 실거래가 or 매수가 기반 지역단가로 추정.
 * DB 서울 기준 placeholder(p_base 7천만, 조합원 5천만)는 지방 분석에서 비례율 폭주 유발.
 */
function estimateParamsForStage(
  z: ZoneData,
  input: CalculationInput,
  market: MarketData,
): Partial<ZoneData> {
  const rank = stageRank(z.project_stage);
  const overrides: Partial<ZoneData> = {};

  // 세대수: 기존 세대수 우선, 없으면 계획 세대수
  const existingUnits = z.existing_units_total ?? z.planned_units_member ?? 0;
  if (existingUnits <= 0) return overrides; // 세대수 모르면 추정 불가 → DB 기본값 유지

  const memberUnits  = z.planned_units_member  ?? 0;
  const generalUnits = z.planned_units_general ?? 0;
  const totalUnits   = z.planned_units_total   ?? existingUnits;

  // 매수가 기반 지역 단가: purchasePrice ÷ desiredPyung = 현재 구역 1평당 시세
  // (이 구역에서 형성된 가격이므로 지역 물가 반영됨)
  const localPricePerPyung = input.desiredPyung > 0 ? input.purchasePrice / input.desiredPyung : 0;

  const officialVal = input.officialValuation > 0
    ? input.officialValuation
    : (market.publicPrice?.officialPrice ?? 0);
  const landPricePerSqm = (input.admin?.landOfficialPricePerSqm ?? 0) ||
                          (z.land_official_price_per_sqm ?? 0);

  // ── C섹션: 총종전자산 감정평가액 ─────────────────────────────────────────
  if (rank < STAGE_RANK.management_disposal) {
    let estimatedTotal = 0;

    if (officialVal > 0) {
      // 공시가 × 감정평가율 × 세대수 (× 0.9: 사용자 단위가 평균보다 클 수 있음)
      estimatedTotal = existingUnits * officialVal * z.avg_appraisal_rate * 0.9;
    } else if (input.landShareSqm > 0 && landPricePerSqm > 0) {
      // 대지지분 × 개별공시지가 → 토지 감정평가액 × 세대수
      estimatedTotal = existingUnits * (input.landShareSqm * landPricePerSqm) / 0.65 * 0.90;
    } else if (z.zone_area_sqm && z.zone_area_sqm > 0 && landPricePerSqm > 0) {
      // 구역 전체 공시지가 기반
      estimatedTotal = (z.zone_area_sqm * landPricePerSqm) / 0.65 * 0.90;
    } else {
      // 최종 fallback: 매수가 ÷ 1.3 × 세대수 (프리미엄 30% 제거)
      estimatedTotal = existingUnits * (input.purchasePrice / 1.3);
    }

    if (estimatedTotal > 0) overrides.total_appraisal_value = estimatedTotal;
  }

  // ── B섹션: 면적 + 단가 (세대수 기반으로만 — zone_area×floor_ratio 금지) ───
  // zone_area_sqm × floor_area_ratio 경로는 구역마다 편차가 너무 커서
  // C섹션 추정값(세대수 기반)과 스케일이 맞지 않아 비례율 폭주 유발
  if (rank < STAGE_RANK.project_implementation) {
    // 표준 분양면적 85㎡/호 (전용59㎡ 기준) — desiredPyung은 사용자의 희망평형이지
    // 구역 평균 단위가 아님. desiredPyung 사용 시 소형(17평) 입력에서 면적 과소추정.
    const AVG_UNIT_SQM = 85;
    const estimatedFloorArea = totalUnits * AVG_UNIT_SQM * 1.3; // 지하층 포함
    overrides.total_floor_area = estimatedFloorArea;

    const aboveGround = estimatedFloorArea / 1.3; // 지상연면적
    if (memberUnits > 0 && totalUnits > 0) {
      overrides.member_sale_area  = aboveGround * (memberUnits  / totalUnits) * 0.80;
      overrides.general_sale_area = aboveGround * (generalUnits / totalUnits) * 0.80;
    } else {
      overrides.member_sale_area  = aboveGround * 0.65 * 0.80;
      overrides.general_sale_area = aboveGround * 0.35 * 0.80;
    }

    // 단가 추정: MOLIT 우선, 없으면 매수가 기반 지역단가
    // DB 서울 기준값(p_base 7천만, 조합원 5천만)은 지방에서 비례율 폭주 원인
    if (market.localPrice?.fromApi && market.localPrice.medianNewAptPricePerPyung > 0) {
      overrides.p_base = market.localPrice.medianNewAptPricePerPyung * 0.85;
      // 조합원 분양가 = 일반분양가 × 0.85 (통상 15% 할인)
      overrides.member_sale_price_per_pyung = market.localPrice.medianNewAptPricePerPyung * 0.85 * 0.85;
    } else if (localPricePerPyung > 0) {
      // 현재 구축 단가 기반: 신축 일반분양가 ≈ 구축 × 1.7, 조합원 ≈ 구축 × 1.4
      overrides.p_base = localPricePerPyung * 1.7;
      overrides.member_sale_price_per_pyung = localPricePerPyung * 1.4;
    }
  }

  return overrides;
}

/**
 * API 데이터로 Zone 상수를 오버라이드한 유효 파라미터 세트
 * DB 값이 fallback, 실시간 API 값이 우선
 */
function resolveZoneParams(z: ZoneData, market: MarketData, desiredPyung: number) {
  // 금리: ECOS API 우선 (단위: % → 소수 변환)
  const annual_pf_rate = market.rates.fromApi
    ? market.rates.pfRate / 100
    : z.annual_pf_rate;
  const annual_holding_rate = market.rates.fromApi
    ? market.rates.mortgageRate / 100
    : z.annual_holding_rate;
  const target_yield_rate = market.rates.fromApi
    ? market.rates.targetYield / 100
    : z.target_yield_rate;

  // 공사비 인상률: KOSIS API 우선
  const r_recent = market.constructionCost.fromApi
    ? market.constructionCost.rRecent
    : z.r_recent;
  const r_long = market.constructionCost.fromApi
    ? market.constructionCost.rLong
    : z.r_long;

  // 시세 데이터 우선순위:
  //   1. nearbyNewAptPrice (인근 신축 5년 이내, complexName 없이 법정동 전체 조회) ← 가장 신뢰
  //   2. localPrice (구역 자체 단지 거래 — 재개발 구역은 대부분 null)
  //   3. 0 (DB placeholder 오염 방지 — 서울 기준 20억 등을 쓰면 지방에서 폭주)
  const nearbyOk = market.nearbyNewAptPrice?.fromApi === true;
  const molitOk  = market.localPrice?.fromApi === true;

  // p_base (일반분양 예상 평당가): 인근 신축 중위가 → 구역 거래 중위가 → DB값
  // DB값은 서울 기준(7천만/평)이므로 API 없을 때 그대로 쓰면 지방에서 비례율 폭주
  const p_base = nearbyOk && market.nearbyNewAptPrice!.medianNewAptPricePerPyung > 0
    ? market.nearbyNewAptPrice!.medianNewAptPricePerPyung
    : (molitOk && market.localPrice!.medianNewAptPricePerPyung > 0
      ? market.localPrice!.medianNewAptPricePerPyung
      : z.p_base);

  // peak_local (역대 최고 평당 분양가, 원/평): 인근 신축 최고 평당가 → 구역 최고 평당가 → 0
  // ※ p_base와 같은 단위(원/평)로 저장해야 computeScenario에서 P로 직접 사용 가능
  const peak_local = nearbyOk && market.nearbyNewAptPrice!.peakPricePerPyung > 0
    ? market.nearbyNewAptPrice!.peakPricePerPyung
    : (molitOk && market.localPrice!.peakPricePerPyung > 0
      ? market.localPrice!.peakPricePerPyung
      : 0);

  // mdd_local (역사적 낙폭률): 신축 시계열 → 구역 시계열 → DB default (낙폭률은 전국 공통이므로 DB도 OK)
  const mdd_local = nearbyOk && market.nearbyNewAptPrice!.mddRate > 0
    ? market.nearbyNewAptPrice!.mddRate
    : (molitOk && market.localPrice!.mddRate > 0
      ? market.localPrice!.mddRate
      : z.mdd_local);

  // neighbor_new_apt_price (입주 후 예상 시세, 희망평형 기준): 인근 신축 시세 → 0
  const neighbor_new_apt_price = nearbyOk && market.nearbyNewAptPrice!.estimatedCurrentPrice > 0
    ? market.nearbyNewAptPrice!.estimatedCurrentPrice
    : (molitOk && market.localPrice!.estimatedCurrentPrice > 0
      ? market.localPrice!.estimatedCurrentPrice
      : 0);

  // 감정평가율: 공시가격 API 우선
  const avg_appraisal_rate = (market.publicPrice?.fromApi && market.publicPrice.estimatedAppraisalRate > 0)
    ? market.publicPrice.estimatedAppraisalRate
    : z.avg_appraisal_rate;

  // ── 착공까지 기간: 공표월 → 오늘 기준 계산, 없으면 단계별 통계 추정
  const monthsDerived = deriveMonthsToConstruction(
    z.project_stage,
    z.construction_start_announced_ym,
  );
  const months_to_construction_start = monthsDerived.value;
  const months_to_construction_source = monthsDerived.source; // "announced" | "statistical"

  // ── 조합원 분양가: 공표/수동 입력값 있으면 그대로, 없으면 p_base(API 기반) × 0.78 추정
  const memberSaleDerived = deriveMemberSalePrice(
    z.member_sale_price_per_pyung,
    z.member_sale_price_source,
    p_base,  // API에서 갱신된 p_base 기준
  );
  const member_sale_price_per_pyung = memberSaleDerived.value;
  const member_sale_price_source = memberSaleDerived.source;

  // 연면적: 건축물대장 API 값 우선 (DB 기본값 200,000㎡ 대체)
  const total_floor_area = market.buildingFloorArea?.fromApi && market.buildingFloorArea.totalFloorArea > 0
    ? market.buildingFloorArea.totalFloorArea
    : z.total_floor_area;

  // 조합원/일반분양 면적 계산
  // 필요 필드: zone_area_sqm, floor_area_ratio_new, planned_units_member, member_avg_pyung
  // 선택 필드: public_contribution_ratio (없으면 0), incentive_far_bonus (없으면 0), efficiency_ratio (없으면 0.80)
  const missingSaleAreaFields: string[] = [];
  if (!z.zone_area_sqm)          missingSaleAreaFields.push('구역면적(zone_area_sqm)');
  if (!z.floor_area_ratio_new)   missingSaleAreaFields.push('재건축후용적률(floor_area_ratio_new)');
  if (!z.planned_units_member)   missingSaleAreaFields.push('조합원세대수(planned_units_member)');
  if (!z.member_avg_pyung)       missingSaleAreaFields.push('조합원평균분양평형(member_avg_pyung)');

  let member_sale_area = z.member_sale_area;
  let general_sale_area = z.general_sale_area;
  let saleAreaSource: "calculated" | "db" | "missing" = "db";

  if (missingSaleAreaFields.length === 0) {
    const effectiveSite = z.zone_area_sqm! * (1 - (z.public_contribution_ratio ?? 0));
    const totalFAR = z.floor_area_ratio_new! + (z.incentive_far_bonus ?? 0);
    const aboveGroundArea = effectiveSite * totalFAR;
    const efficiency = z.efficiency_ratio ?? 0.80;
    const netArea = aboveGroundArea * efficiency;
    const calcMemberArea = z.planned_units_member! * z.member_avg_pyung!;
    const calcGeneralArea = Math.max(0, netArea - calcMemberArea);
    member_sale_area = calcMemberArea;
    general_sale_area = calcGeneralArea;
    saleAreaSource = "calculated";
  } else {
    saleAreaSource = "missing";
  }

  return {
    ...z,
    annual_pf_rate,
    annual_holding_rate,
    target_yield_rate,
    r_recent,
    r_long,
    p_base,
    peak_local,
    mdd_local,
    neighbor_new_apt_price,
    avg_appraisal_rate,
    months_to_construction_start,
    member_sale_price_per_pyung,
    total_floor_area,
    member_sale_area,
    general_sale_area,
    _derivedSources: {
      monthsToConstruction: months_to_construction_source,
      memberSalePrice: member_sale_price_source,
      saleAreaSource,
      missingSaleAreaFields,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 메인 계산 함수
// ═══════════════════════════════════════════════════════════════════════════════

export async function calculateAnalysis(
  input: CalculationInput
): Promise<{ data: CalculationResult | null; error: string | null }> {
  const supabase = await createClient();

  const { data: zone, error: dbError } = await supabase
    .from("zones_data")
    .select("*")
    .eq("zone_id", input.zoneId)
    .single();

  if (dbError || !zone) {
    return { data: null, error: "해당 구역 데이터를 찾을 수 없습니다." };
  }

  const baseZone = zone as ZoneData;
  const zoneName = baseZone.zone_name ?? input.zoneId;

  // Step 1: 실시간 시장 데이터 수집 — base zone의 lawd_cd/bjd_code/zone_name 사용
  const marketData = await fetchMarketData({
    lawdCd: baseZone.lawd_cd ?? undefined,
    bjdCode: baseZone.bjd_code ?? undefined,
    desiredPyung: input.desiredPyung,
    officialPrice: input.officialValuation,
    complexName: baseZone.zone_name ?? undefined,
    lat: baseZone.lat ?? undefined,
    lng: baseZone.lng ?? undefined,
  });

  // Step 2: 단계 미도달 필드 추정 (DB 플레이스홀더 → 역산 추정값)
  const estimatedOverrides = estimateParamsForStage(baseZone, input, marketData);

  // Step 3: DB + 추정값 병합 (API 오버라이드 전 기준값)
  const zForApi: ZoneData = { ...baseZone, ...estimatedOverrides };

  // Step 4: 공시가 — 사용자 입력 우선, 없으면 NSDI 자동조회 결과 사용
  const effectiveOfficialValuation =
    input.officialValuation > 0
      ? input.officialValuation
      : (marketData.publicPrice?.officialPrice ?? 0);
  const effectiveInput = effectiveOfficialValuation !== input.officialValuation
    ? { ...input, officialValuation: effectiveOfficialValuation }
    : input;

  // Step 5: API 데이터로 Zone 상수 오버라이드 (nearbyNewAptPrice → p_base/peak_local/neighbor)
  const apiResolved = resolveZoneParams(zForApi, marketData, input.desiredPyung) as ResolvedZoneData;

  // Step 6: 관리자 명시 입력값 최우선 적용 (API 값을 덮어씀)
  // 관리자가 직접 입력한 값은 어떤 자동화 값보다 우선
  const adm = input.admin ?? {};
  const resolvedZ: ResolvedZoneData = {
    ...apiResolved,
    ...(adm.totalAppraisalValue      ? { total_appraisal_value:          adm.totalAppraisalValue }    : {}),
    ...(adm.totalFloorArea           ? { total_floor_area:                adm.totalFloorArea }          : {}),
    ...(adm.generalSaleArea != null  ? { general_sale_area:               adm.generalSaleArea }         : {}),
    ...(adm.memberSaleArea           ? { member_sale_area:                adm.memberSaleArea }          : {}),
    ...(adm.memberSalePricePerPyung  ? { member_sale_price_per_pyung:     adm.memberSalePricePerPyung, member_sale_price_source: "manual" as const } : {}),
    ...(adm.neighborNewAptPrice      ? { neighbor_new_apt_price:          adm.neighborNewAptPrice }    : {}),
    ...(adm.generalSalePricePerPyung ? { p_base:                         adm.generalSalePricePerPyung } : {}),
    ...(adm.landOfficialPricePerSqm  ? { land_official_price_per_sqm:    adm.landOfficialPricePerSqm } : {}),
    ...(adm.constructionStartYm      ? { construction_start_announced_ym: adm.constructionStartYm }   : {}),
  };

  const optimistic  = computeScenario("optimistic",  effectiveInput, resolvedZ);
  const neutral     = computeScenario("neutral",     effectiveInput, resolvedZ);
  const pessimistic = computeScenario("pessimistic", effectiveInput, resolvedZ);

  // 산티 체크: 비례율 폭주 또는 분양가 0 감지 시 경고 (결과는 유지)
  const allScenarios = [optimistic, neutral, pessimistic];
  const warnings: string[] = [];
  const hasBadPropRate = allScenarios.some(
    (s) => s.proportionalRate > 500 || s.proportionalRate < 0
  );
  const hasBadPrice =
    allScenarios.some((s) => s.appliedGeneralSalePrice <= 0) ||
    resolvedZ.member_sale_price_per_pyung <= 0;
  if (hasBadPropRate) {
    warnings.push("비례율이 비정상 범위입니다 (>500% 또는 <0%). API 조회 실패로 서울 기준 DB 기본값이 적용됐을 수 있습니다. 관리자 수동 검토 필요.");
  }
  if (hasBadPrice) {
    warnings.push("분양가가 0 이하입니다. 지역 시세 데이터를 가져오지 못했을 가능성이 있습니다.");
  }

  return {
    data: {
      zoneId: input.zoneId,
      zoneName,
      projectType: baseZone.project_type,
      projectStage: baseZone.project_stage,
      input,
      optimistic,
      neutral,
      pessimistic,
      marketDataSources: {
        ratesFromApi: marketData.rates.fromApi,
        constructionCostFromApi: marketData.constructionCost.fromApi,
        localPriceFromApi: marketData.localPrice?.fromApi ?? false,
        publicPriceFromApi: marketData.publicPrice?.fromApi ?? false,
        nearbyNewAptFromApi: marketData.nearbyNewAptPrice?.fromApi ?? false,
        fetchedAt: marketData.fetchedAt,
      },
      debugParams: {
        lawd_cd: baseZone.lawd_cd,
        bjd_code: baseZone.bjd_code,
        effectiveLawdCd: (baseZone.bjd_code?.slice(0, 5)) || baseZone.lawd_cd || null,
        existingUnits: baseZone.existing_units_total ?? baseZone.planned_units_member ?? 0,
        plannedUnitsMember: baseZone.planned_units_member,
        total_appraisal_value: resolvedZ.total_appraisal_value,
        total_floor_area: resolvedZ.total_floor_area,
        member_sale_area: resolvedZ.member_sale_area,
        general_sale_area: resolvedZ.general_sale_area,
        p_base: resolvedZ.p_base,
        member_sale_price_per_pyung: resolvedZ.member_sale_price_per_pyung,
        peak_local: resolvedZ.peak_local,
        neighbor_new_apt_price: resolvedZ.neighbor_new_apt_price,
        nearbyOk: marketData.nearbyNewAptPrice?.fromApi === true,
        molitOk: marketData.localPrice?.fromApi === true,
        buildingFloorAreaFromApi: marketData.buildingFloorArea?.fromApi === true,
        buildingFloorAreaRaw: marketData.buildingFloorArea?.totalFloorArea ?? null,
        buildingFloorAreaFAR: marketData.buildingFloorArea?.floorAreaRatio ?? null,
        projectStageRank: stageRank(baseZone.project_stage),
        saleAreaSource: resolvedZ._derivedSources.saleAreaSource,
        missingSaleAreaFields: resolvedZ._derivedSources.missingSaleAreaFields,
      },
      warnings,
      calculatedAt: new Date().toISOString(),
    },
    error: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 시나리오 계산 핵심 로직
// ═══════════════════════════════════════════════════════════════════════════════

type ResolvedZoneData = ZoneData & {
  _derivedSources: {
    monthsToConstruction: "announced" | "statistical";
    memberSalePrice: "announced" | "manual" | "cost_estimated";
    saleAreaSource: "calculated" | "db" | "missing";
    missingSaleAreaFields: string[];
  };
};

function computeScenario(
  type: "optimistic" | "neutral" | "pessimistic",
  input: CalculationInput,
  z: ResolvedZoneData
): ScenarioResult {
  const { purchasePrice, purchaseLoanAmount, currentDeposit, desiredPyung, officialValuation } = input;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: 시나리오별 총 사업 기간 T (개월)
  // ─────────────────────────────────────────────────────────────────────────
  let T: number;
  if (type === "optimistic") {
    // 인허가 패스트트랙: 행정 기간 25% 단축
    T = z.base_project_months - z.t_admin_remaining * 0.25;
  } else if (type === "pessimistic") {
    // 시공사 분쟁/파업 지연 가산
    T = z.base_project_months + z.delay_conflict;
  } else {
    T = z.base_project_months;
  }

  // 착공까지 남은 기간과 공사 기간 분리
  let monthsToStart: number;
  if (type === "optimistic") {
    monthsToStart = Math.max(0, z.months_to_construction_start - z.t_admin_remaining * 0.25);
  } else if (type === "pessimistic") {
    monthsToStart = z.months_to_construction_start + z.delay_conflict * 0.3;
  } else {
    monthsToStart = z.months_to_construction_start;
  }
  const constructionPeriodMonths = T - monthsToStart;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: 일반 분양가 P_scenario (평당, 원)
  // ─────────────────────────────────────────────────────────────────────────
  let P: number;
  if (type === "optimistic") {
    // peak_local이 유효(p_base 초과)하면 95% 적용, 아니면 p_base 15% 상승 추정
    P = z.peak_local > z.p_base ? z.peak_local * 0.95 : z.p_base * 1.15;
  } else if (type === "pessimistic") {
    // 낙폭 적용, 최소 p_base의 80% 보장 (극단 시나리오 방지)
    P = Math.max(z.p_base * 0.8, z.p_base * (1 - z.mdd_local));
  } else {
    P = z.p_base;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: 평당 공사비 C_T — 지수평활법(Exponential Smoothing)
  //
  // 핵심 아이디어: 최근 급등세(r_recent)가 장기 평균(r_long)으로
  // 시간이 지날수록 '지수적으로' 수렴한다고 가정.
  //
  //   W = e^(-λ × T)          ← 감쇠 가중치. T가 클수록 W→0 (장기 평균 지배)
  //   r_adj = W×r_recent + (1-W)×r_long
  //   C_T = C0 × (1 + r_adj)^T  ← 복리(지수) 성장
  // ─────────────────────────────────────────────────────────────────────────
  const C0 = z.current_construction_cost;
  let C_T: number;
  let appliedMonthlyRate: number;

  if (type === "pessimistic") {
    // 지수평활 배제 — 최근 급등세 유지 + 지정학적 위기 프리미엄 가산
    appliedMonthlyRate = z.r_recent + z.alpha;
    C_T = C0 * Math.pow(1 + appliedMonthlyRate, T);
  } else {
    let W = Math.exp(-z.decay_factor * T);
    if (type === "optimistic") W *= 0.5; // 물가 안정화 가속
    appliedMonthlyRate = W * z.r_recent + (1 - W) * z.r_long;
    C_T = C0 * Math.pow(1 + appliedMonthlyRate, T);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4~7: 사업비 / 수입 / 비례율
  // ─────────────────────────────────────────────────────────────────────────
  const totalFloorAreaPyung   = z.total_floor_area / 3.3058;
  const generalSaleAreaPyung  = z.general_sale_area / 3.3058;
  const memberSaleAreaPyung   = z.member_sale_area / 3.3058;

  const totalConstructionCost  = C_T * totalFloorAreaPyung;
  const baseBusinessExpense    = totalConstructionCost * 0.15;
  const financialCost          =
    totalConstructionCost * z.pf_loan_ratio * (z.annual_pf_rate / 12) * T;
  const totalCost = totalConstructionCost + baseBusinessExpense + financialCost;

  const memberRevenue  = z.member_sale_price_per_pyung * memberSaleAreaPyung;
  const generalRevenue = P * generalSaleAreaPyung;
  const totalRevenue   = generalRevenue + memberRevenue;

  // 비례율: (총수입 - 총사업비) / 총종전평가액
  const proportionalRate =
    ((totalRevenue - totalCost) / z.total_appraisal_value) * 100;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 8~11: 개인 물건 분석
  // ─────────────────────────────────────────────────────────────────────────

  // 감정평가액 계산:
  //   [대지지분 기반 — 재건축 정밀 계산]
  //   대지지분(㎡) × 개별공시지가(원/㎡)가 모두 있을 때 사용
  //
  //   토지 감정평가액 = 대지지분 × 공시지가 ÷ 토지현실화율(0.65) × 0.90 (보수 감정배율)
  //   건물 감정평가액 = max(0, 공시가격 - 토지 공시가격) ÷ 공동주택현실화율(0.69) × 0.80
  //   → 재건축 대상 구축 아파트는 건물이 감가상각 거의 완료 → 토지가 감정평가 대부분 차지
  //
  //   [공시가격 기반 — fallback]
  //   대지지분 정보 없을 때: officialValuation × avg_appraisal_rate
  const { landShareSqm } = input;
  let estimatedAppraisalValue: number;

  if (landShareSqm > 0 && z.land_official_price_per_sqm && z.land_official_price_per_sqm > 0) {
    // 대지지분 + 개별공시지가로 정밀 계산
    const landPublicValue   = landShareSqm * z.land_official_price_per_sqm;
    const landAppraisal     = landPublicValue / 0.65 * 0.90;
    const buildingPublic    = Math.max(0, officialValuation - landPublicValue);
    const buildingAppraisal = buildingPublic / 0.69 * 0.80;
    estimatedAppraisalValue = landAppraisal + buildingAppraisal;
  } else if (officialValuation > 0) {
    // 공시가 × 감정평가율
    estimatedAppraisalValue = officialValuation * z.avg_appraisal_rate;
  } else {
    // 모든 가격 정보 없음 → 매수가 기반 역산
    // 재건축 구축 아파트: 프리미엄(웃돈) 제거 → 토지 감정평가액 추정
    // 통상 재건축 매수가 = 감정평가액 × (1 + 프리미엄율)
    // 프리미엄율 0.3 가정: 감정평가액 ≈ 매수가 ÷ 1.3
    estimatedAppraisalValue = purchasePrice / 1.3;
  }
  const rightsValue             = estimatedAppraisalValue * (proportionalRate / 100);
  const estimatedPremium        = purchasePrice - estimatedAppraisalValue;
  const premiumBubbleIndex      =
    estimatedAppraisalValue > 0
      ? (estimatedPremium / estimatedAppraisalValue) * 100
      : 0;

  // 프리미엄 회수 소요 연수: 입주 후 시세 상승분이 프리미엄을 언제 회수하는지 추정
  // 연 2% 시세 상승 가정 (보수적)
  const annualAppreciationRate = 0.02;
  const premiumRecoveryYears =
    estimatedPremium > 0 && z.neighbor_new_apt_price > 0
      ? Math.log(1 + estimatedPremium / z.neighbor_new_apt_price) /
        Math.log(1 + annualAppreciationRate)
      : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 12~14: 분담금 및 납부 스케줄
  // ─────────────────────────────────────────────────────────────────────────
  const targetMemberSalePrice  = desiredPyung * z.member_sale_price_per_pyung;
  const additionalContribution = targetMemberSalePrice - rightsValue;

  // 분담금 납부 스케줄 (착공 시 50%, 입주 시 50%)
  const contributionAtConstruction =
    additionalContribution > 0
      ? additionalContribution * z.contribution_at_construction
      : additionalContribution; // 환급이면 입주 시 일괄 지급
  const contributionAtCompletion =
    additionalContribution > 0
      ? additionalContribution * (1 - z.contribution_at_construction)
      : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 15: 부대 비용
  // ─────────────────────────────────────────────────────────────────────────

  // 취득세 (매수가 기준 — 조합원 입주권 취득)
  const acquisitionTax = purchasePrice * z.acquisition_tax_rate;

  // 보유기간 이자 비용: 대출금 × 월 금리 × 총 보유 개월
  // 총 보유 기간 = 지금부터 입주까지 (T개월)
  const holdingInterestCost =
    purchaseLoanAmount * (z.annual_holding_rate / 12) * T;

  // 이사/명도비
  const moveOutCost = z.move_out_cost;

  const totalAdditionalCosts = acquisitionTax + holdingInterestCost + moveOutCost;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 16: 투자 원금 및 수익
  // ─────────────────────────────────────────────────────────────────────────
  const totalInvestmentCost     = purchasePrice + additionalContribution;
  const totalInvestmentWithCosts = totalInvestmentCost + totalAdditionalCosts;
  const actualInitialInvestment = purchasePrice - currentDeposit;
  // 실제 현금 투입 (대출 및 보증금 레버리지 제외)
  const effectiveCash           = purchasePrice - purchaseLoanAmount - currentDeposit;

  const netProfit             = z.neighbor_new_apt_price - totalInvestmentCost;
  const netProfitAfterCosts   = z.neighbor_new_apt_price - totalInvestmentWithCosts;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 17: 수익률 지표
  // ─────────────────────────────────────────────────────────────────────────
  const returnOnEquity =
    actualInitialInvestment > 0
      ? (netProfit / actualInitialInvestment) * 100
      : 0;

  const returnOnTotalInvestment =
    totalInvestmentWithCosts > 0
      ? (netProfitAfterCosts / totalInvestmentWithCosts) * 100
      : 0;

  const yearsToCompletion = T / 12;
  // 연환산 수익률: (1 + 총수익률)^(1/n) - 1
  const annualizedReturn =
    actualInitialInvestment > 0 && yearsToCompletion > 0
      ? (Math.pow(1 + netProfit / actualInitialInvestment, 1 / yearsToCompletion) - 1) * 100
      : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 18: IRR 계산 (뉴턴-랩슨 근사)
  //
  // 현금흐름 모델:
  //   t=0:          -(매수가 - 대출금 - 보증금) - 취득세  [초기 현금 지출]
  //   t=착공:       -착공 시 분담금
  //   t=T(입주):    +입주 시세 + 보증금 반환 - 입주 시 분담금 - 대출금 상환
  // ─────────────────────────────────────────────────────────────────────────
  const cashFlows: Array<{ month: number; amount: number }> = [
    { month: 0,                          amount: -(effectiveCash + acquisitionTax + moveOutCost) },
    { month: Math.round(monthsToStart),  amount: -(contributionAtConstruction) },
    { month: Math.round(T),              amount: z.neighbor_new_apt_price + currentDeposit - contributionAtCompletion - purchaseLoanAmount },
  ];

  const irr = calcIRR(cashFlows) * 100; // 월→연 환산은 calcIRR 내부에서 처리

  // ─────────────────────────────────────────────────────────────────────────
  // Step 19: NPV (순현재가치)
  //   목표 수익률(target_yield_rate)을 할인율로 적용
  //   NPV > 0 이면 기회비용 이상의 수익
  // ─────────────────────────────────────────────────────────────────────────
  const monthlyDiscount = z.target_yield_rate / 12;
  const npv = cashFlows.reduce((acc, cf) => {
    return acc + cf.amount / Math.pow(1 + monthlyDiscount, cf.month);
  }, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 20: 리스크 지표
  // ─────────────────────────────────────────────────────────────────────────

  // 손익분기 일반분양가 (netProfit = 0 이 되는 평당 분양가)
  // neighbor = (P_break × generalSaleAreaPyung + memberRevenue) - totalCostFixed - purchasePrice - additionalContribution(P_break에 의존)
  // 단순화: 분담금이 고정이라 가정하면:
  // P_break = (totalInvestmentCost - memberRevenue + totalConstructionCost + baseBusinessExpense + financialCost) / generalSaleAreaPyung
  const breakEvenGeneralSalePrice =
    generalSaleAreaPyung > 0
      ? (totalCost - memberRevenue + totalInvestmentCost) / generalSaleAreaPyung
      : 0;

  // 최대 감당 가능 분담금: 순수익 0이 되는 분담금 상한
  const maxAffordableContribution = z.neighbor_new_apt_price - purchasePrice;

  // 기회비용 대비 초과 수익 (연 목표수익률 투자 대비)
  const opportunityCostGain =
    actualInitialInvestment * (Math.pow(1 + z.target_yield_rate, yearsToCompletion) - 1);
  const opportunityCostGap = netProfit - opportunityCostGain;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 21: 단계별 현금흐름
  // ─────────────────────────────────────────────────────────────────────────
  const stageCashFlows = buildStageCashFlows(
    input, z, T, monthsToStart,
    acquisitionTax, moveOutCost,
    contributionAtConstruction, contributionAtCompletion
  );

  const LABELS = {
    optimistic: "낙관 시나리오",
    neutral:    "중립 시나리오",
    pessimistic:"비관 시나리오",
  };

  return {
    scenarioType: type,
    scenarioLabel: LABELS[type],
    appliedMonths: Math.round(T),
    monthsToConstructionStart: Math.round(monthsToStart),
    constructionPeriodMonths: Math.round(constructionPeriodMonths),
    monthsToConstructionSource: (type === "neutral" ? z._derivedSources.monthsToConstruction : "db_override") as "announced" | "statistical" | "db_override",
    appliedConstructionCostPerPyung: Math.round(C_T),
    constructionCostGrowthRate: Math.round(appliedMonthlyRate * 10000) / 100, // 소수점 2자리 %
    appliedGeneralSalePrice: Math.round(P),
    memberSalePriceSource: z._derivedSources.memberSalePrice,
    estimatedAppraisalValue: Math.round(estimatedAppraisalValue),
    appraisalMethod: (
      landShareSqm > 0 && z.land_official_price_per_sqm ? "land_based" :
      officialValuation > 0 ? "official_rate" : "purchase_based"
    ) as "land_based" | "official_rate" | "purchase_based",
    proportionalRate: Math.round(proportionalRate * 10) / 10,
    rightsValue: Math.round(rightsValue),
    estimatedPremium: Math.round(estimatedPremium),
    premiumBubbleIndex: Math.round(premiumBubbleIndex * 10) / 10,
    premiumRecoveryYears: Math.round(premiumRecoveryYears * 10) / 10,
    targetMemberSalePrice: Math.round(targetMemberSalePrice),
    additionalContribution: Math.round(additionalContribution),
    contributionAtConstruction: Math.round(contributionAtConstruction),
    contributionAtCompletion: Math.round(contributionAtCompletion),
    acquisitionTax: Math.round(acquisitionTax),
    holdingInterestCost: Math.round(holdingInterestCost),
    moveOutCost: Math.round(moveOutCost),
    totalAdditionalCosts: Math.round(totalAdditionalCosts),
    totalInvestmentCost: Math.round(totalInvestmentCost),
    totalInvestmentWithCosts: Math.round(totalInvestmentWithCosts),
    actualInitialInvestment: Math.round(actualInitialInvestment),
    effectiveCash: Math.round(effectiveCash),
    netProfit: Math.round(netProfit),
    netProfitAfterCosts: Math.round(netProfitAfterCosts),
    returnOnEquity: Math.round(returnOnEquity * 10) / 10,
    returnOnTotalInvestment: Math.round(returnOnTotalInvestment * 10) / 10,
    annualizedReturn: Math.round(annualizedReturn * 10) / 10,
    irr: Math.round(irr * 10) / 10,
    npv: Math.round(npv),
    breakEvenGeneralSalePrice: Math.round(breakEvenGeneralSalePrice),
    maxAffordableContribution: Math.round(maxAffordableContribution),
    opportunityCostGap: Math.round(opportunityCostGap),
    stageCashFlows,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 단계별 현금흐름 빌더
// ═══════════════════════════════════════════════════════════════════════════════

function buildStageCashFlows(
  input: CalculationInput,
  z: ZoneData,
  T: number,
  monthsToStart: number,
  acquisitionTax: number,
  moveOutCost: number,
  contributionAtConstruction: number,
  contributionAtCompletion: number,
): StageCashFlow[] {
  const { purchasePrice, purchaseLoanAmount, currentDeposit } = input;
  const effectiveCash = purchasePrice - purchaseLoanAmount - currentDeposit;

  // 착공 기준 이주 시점: 착공 2개월 전
  const relocationMonth = Math.max(0, monthsToStart - 2);
  // 입주 시점
  const completionMonth = Math.round(T);

  const stages: Array<{ stage: string; label: string; month: number; out: number; inc: number }> = [
    {
      stage: "purchase",
      label: "매수 (현재)",
      month: 0,
      out: effectiveCash + acquisitionTax,
      inc: 0,
    },
    {
      stage: "relocation",
      label: "이주/철거",
      month: Math.round(relocationMonth),
      out: moveOutCost,
      // 이주비 지급 (관리처분 시 통상 감정평가액의 일정 비율): 보수적으로 0 처리
      inc: 0,
    },
    {
      stage: "construction_start",
      label: "착공",
      month: Math.round(monthsToStart),
      out: contributionAtConstruction > 0 ? contributionAtConstruction : 0,
      inc: contributionAtConstruction < 0 ? Math.abs(contributionAtConstruction) : 0,
    },
    {
      stage: "completion",
      label: "준공/입주",
      month: completionMonth,
      out: contributionAtCompletion > 0 ? contributionAtCompletion + purchaseLoanAmount : purchaseLoanAmount,
      inc: z.neighbor_new_apt_price + currentDeposit + (contributionAtCompletion < 0 ? Math.abs(contributionAtCompletion) : 0),
    },
  ];

  let cumulativeOut = 0;
  let cumulativeIn  = 0;

  return stages.map((s) => {
    cumulativeOut += s.out;
    cumulativeIn  += s.inc;
    return {
      stage: s.stage,
      label: s.label,
      monthFromNow: s.month,
      cumulativeCashOut: Math.round(cumulativeOut),
      cumulativeCashIn: Math.round(cumulativeIn),
      netCashPosition: Math.round(cumulativeIn - cumulativeOut),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IRR 계산 — 뉴턴-랩슨(Newton-Raphson) 수치 해석
// 월간 현금흐름 기반 → 연간 IRR로 환산
// ═══════════════════════════════════════════════════════════════════════════════

function calcIRR(cashFlows: Array<{ month: number; amount: number }>): number {
  const MAX_ITER = 1000;
  const TOLERANCE = 1e-8;
  let rate = 0.01; // 초기값: 월 1%

  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0;
    let dnpv = 0; // NPV 미분값

    for (const cf of cashFlows) {
      const discount = Math.pow(1 + rate, cf.month);
      npv  += cf.amount / discount;
      dnpv -= (cf.month * cf.amount) / (discount * (1 + rate));
    }

    if (Math.abs(dnpv) < TOLERANCE) break;
    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < TOLERANCE) {
      rate = newRate;
      break;
    }
    rate = newRate;

    // 발산 방지
    if (rate < -0.99) rate = -0.5;
    if (rate > 1)     rate = 0.5;
  }

  // 월 IRR → 연 IRR 환산: (1 + r_monthly)^12 - 1
  return Math.pow(1 + rate, 12) - 1;
}

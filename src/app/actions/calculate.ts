"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchMarketData } from "@/lib/market-data";
import type { MarketData } from "@/lib/market-data";
import { deriveMonthsToConstruction, deriveMemberSalePrice, type StagePercentileData } from "@/lib/derive-zone-params";

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
  monthsToConstructionSource: "announced" | "statistical" | "db_percentile" | "db_override";

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

  // ── 계산 과정 중간값 (관리자 검증용) ──
  calcBreakdown: {
    // 사업기간
    T: number;                        // 총 사업기간 (개월)
    monthsToStart: number;            // 착공까지 (개월)
    constructionMonths: number;       // 공사기간 (개월)
    // 공사비
    C0: number;                       // 현재 평당 공사비 (원)
    W: number;                        // 지수평활 감쇠계수
    appliedMonthlyRate: number;       // 적용 월 인상률
    C_T: number;                      // 착공시 예측 평당 공사비 (원)
    // 연면적 (역산 과정)
    existingFloorAreaSqm: number | null;  // 기존 연면적 (건축물대장)
    existingFAR: number | null;           // 기존 용적률 (건축물대장)
    derivedSiteAreaSqm: number | null;    // 역산 대지면적 = 기존연면적 ÷ 기존용적률
    newFAR: number | null;                // 신축 용적률
    totalFloorAreaPyung: number;      // 신축 총연면적 (평)
    generalSaleAreaPyung: number;     // 일반분양 면적 (평)
    memberSaleAreaPyung: number;      // 조합원분양 면적 (평)
    // 총사업비
    pureCost: number;                 // 순수공사비 (원)
    otherCost: number;                // 기타사업비 (원)
    financialCost: number;            // 금융비용 (원)
    totalCost: number;                // 총사업비 (원)
    // 분양수익
    P: number;                        // 일반분양가 (원/평)
    memberSalePricePerPyung: number;  // 조합원분양가 (원/평)
    memberSalePriceMethod: "announced" | "manual" | "discount_estimated" | "prop_rate_inverse"; // 결정 방식
    memberRevenue: number;            // 조합원분양수익 (원)
    generalRevenue: number;           // 일반분양수익 (원)
    totalRevenue: number;             // 총분양수익 (원)
    // 비례율
    totalAppraisalValue: number;      // 총종전자산 (원)
    landOfficialPricePerSqm: number | null;  // 공시지가 (원/㎡)
    priorAssetMethodUsed: string;     // 종전자산 추정 방법
    // 사업기간 상세
    stageElapsedMonths: number | null; // 현재 단계 경과 개월
    monthsToStartRaw: number;          // 경과분 차감 전 착공까지 개월
    // 총연면적 유도
    zoneAreaSqm: number | null;
    floorAreaRatioNew: number | null;
    totalFloorAreaSqm: number;         // ㎡ 단위
    // 분양면적 세대수 상세
    saleUnitsU40: number | null;
    saleUnitsC40_60: number | null;
    saleUnitsC60_85: number | null;
    saleUnitsC85_135: number | null;
    saleUnitsO135: number | null;
    plannedUnitsMember: number | null;
    plannedUnitsGeneral: number | null;
    memberSaleRatio: number | null;    // 조합원면적 비율
    // 조합원분양가 역산 상세 (Option B)
    memberSaleInverseGeneralRevenue: number | null;
    memberSaleInverseTotalCost: number | null;
    memberSaleInverseTotalAppraisal: number | null;
    // 개인 감정평가
    appraisalMethodDetail: string;    // 감정평가 방법 설명
  };
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
    missingSaleAreaFields: string[];
    // 종전자산 추정 방법별 값
    priorAssetMethod1: number | null;
    priorAssetMethod2: number | null;
    priorAssetMethod3: number | null;
    priorAssetMethodUsed: string;
    // 세대수 · 구역 상세
    new_units_sale_u40: number | null;
    new_units_sale_40_60: number | null;
    new_units_sale_60_85: number | null;
    new_units_sale_85_135: number | null;
    new_units_sale_o135: number | null;
    zone_area_sqm: number | null;
    floor_area_ratio_new: number | null;
    land_official_price_per_sqm: number | null;
    stageElapsedMonths: number | null;
    stageStartDate: string | null;
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
  sigungu: string | null;              // 시군구 텍스트 — 지역별 조합원 할인율 분류
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
  floor_area_ratio_existing: number | null;
  lat: number | null;
  lng: number | null;
  public_contribution_ratio: number | null;
  incentive_far_bonus: number | null;
  member_avg_pyung: number | null;
  efficiency_ratio: number | null;
  // 신축 분양 세대수 — 평형별 (엑셀 c[20]~c[24])
  new_units_sale_u40: number | null;
  new_units_sale_40_60: number | null;
  new_units_sale_60_85: number | null;
  new_units_sale_85_135: number | null;
  new_units_sale_o135: number | null;
  new_units_sale_total: number | null;
  // 단계별 진행 날짜 (경과 개월 계산용)
  zone_designation_date: string | null;
  association_approval_date: string | null;
  project_implementation_date: string | null;
  management_disposal_date: string | null;
  construction_start_date: string | null;
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

// ─── 단계별 착공까지 기간 백분위 — DB 실측 캐시 ─────────────────────────────
interface StagePercentilesCache {
  management_disposal:    StagePercentileData;
  project_implementation: StagePercentileData;
  zone_designation:       StagePercentileData;
}

const STAGE_PCT_FALLBACK: StagePercentilesCache = {
  management_disposal:    { p25: 12, p50: 18, p75: 28, n: 0 },
  project_implementation: { p25: 20, p50: 30, p75: 45, n: 0 },
  zone_designation:       { p25: 45, p50: 60, p75: 84, n: 0 },
};

let _stagePctCache: StagePercentilesCache | null = null;
let _stagePctCacheTs = 0;

function monthsBetweenDates(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return diff > 0 && diff < 300 ? diff : null;
}

function computePercentiles(durations: number[]): StagePercentileData {
  const sorted = [...durations].sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 5) return { p25: 0, p50: 0, p75: 0, n };
  const pct = (p: number) => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return Math.round(sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]));
  };
  return { p25: pct(25), p50: pct(50), p75: pct(75), n };
}

async function fetchStagePercentiles(): Promise<StagePercentilesCache> {
  const now = Date.now();
  if (_stagePctCache && now - _stagePctCacheTs < 24 * 60 * 60 * 1000) {
    return _stagePctCache;
  }
  try {
    const supabase = await createClient();

    const [{ data: mdRows }, { data: piRows }, { data: zdRows }] = await Promise.all([
      supabase
        .from('zones_data')
        .select('management_disposal_date, construction_start_date')
        .not('management_disposal_date', 'is', null)
        .not('construction_start_date', 'is', null),
      supabase
        .from('zones_data')
        .select('project_implementation_date, construction_start_date')
        .not('project_implementation_date', 'is', null)
        .not('construction_start_date', 'is', null),
      supabase
        .from('zones_data')
        .select('zone_designation_date, construction_start_date')
        .not('zone_designation_date', 'is', null)
        .not('construction_start_date', 'is', null),
    ]);

    const result: StagePercentilesCache = {
      management_disposal: computePercentiles(
        (mdRows ?? []).map((r: { management_disposal_date: string | null; construction_start_date: string | null }) =>
          monthsBetweenDates(r.management_disposal_date, r.construction_start_date)).filter((v): v is number => v !== null)
      ),
      project_implementation: computePercentiles(
        (piRows ?? []).map((r: { project_implementation_date: string | null; construction_start_date: string | null }) =>
          monthsBetweenDates(r.project_implementation_date, r.construction_start_date)).filter((v): v is number => v !== null)
      ),
      zone_designation: computePercentiles(
        (zdRows ?? []).map((r: { zone_designation_date: string | null; construction_start_date: string | null }) =>
          monthsBetweenDates(r.zone_designation_date, r.construction_start_date)).filter((v): v is number => v !== null)
      ),
    };

    // 표본 부족하면 fallback 유지
    if (result.management_disposal.n < 5) result.management_disposal = STAGE_PCT_FALLBACK.management_disposal;
    if (result.project_implementation.n < 5) result.project_implementation = STAGE_PCT_FALLBACK.project_implementation;
    if (result.zone_designation.n < 5) result.zone_designation = STAGE_PCT_FALLBACK.zone_designation;

    _stagePctCache = result;
    _stagePctCacheTs = now;
    return result;
  } catch {
    return STAGE_PCT_FALLBACK;
  }
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
interface PriorAssetBreakdown {
  method1: number | null;  // 세대수 × 공시가 × 감평율
  method2: number | null;  // 구축 실거래 역산
  method3: number | null;  // 구역공시지가 × 1.5
  methodUsed: string;
}

function estimateParamsForStage(
  z: ZoneData,
  input: CalculationInput,
  market: MarketData,
): { overrides: Partial<ZoneData>; priorAsset: PriorAssetBreakdown } {
  const rank = stageRank(z.project_stage);
  const overrides: Partial<ZoneData> = {};
  const priorAsset: PriorAssetBreakdown = { method1: null, method2: null, method3: null, methodUsed: "fallback" };

  // 세대수: 기존 세대수 우선, 없으면 계획 세대수
  const existingUnits = z.existing_units_total ?? z.planned_units_member ?? 0;
  if (existingUnits <= 0) return { overrides, priorAsset }; // 세대수 모르면 추정 불가 → DB 기본값 유지

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

  // ── C섹션: 총종전자산 감정평가액 — 3가지 방법 모두 계산 (비교용) ──────────
  if (rank < STAGE_RANK.management_disposal) {
    // method1: 세대수 × 공시가 × 감평율 × 0.9
    if (officialVal > 0) {
      priorAsset.method1 = existingUnits * officialVal * z.avg_appraisal_rate * 0.9;
    }

    // method2: 구축(20년+) 실거래 역산 — 연면적 × 65%(주거비율) × 구축시세 × 0.8
    if (market.oldAptPrice?.fromApi && market.oldAptPrice.medianPricePerPyung > 0 && z.total_floor_area > 0) {
      priorAsset.method2 = (z.total_floor_area / 3.3058) * 0.65 * market.oldAptPrice.medianPricePerPyung * 0.8;
    }

    // method3: 구역면적 × 개별공시지가 × 1.5
    if (z.zone_area_sqm && z.zone_area_sqm > 0 && landPricePerSqm > 0) {
      priorAsset.method3 = z.zone_area_sqm * landPricePerSqm * 1.5;
    }

    // 우선순위: method3 → method1 → method2 → 대지지분 역산 → fallback
    let estimatedTotal = 0;
    if (priorAsset.method3) {
      estimatedTotal = priorAsset.method3;
      priorAsset.methodUsed = "method3";
    } else if (priorAsset.method1) {
      estimatedTotal = priorAsset.method1;
      priorAsset.methodUsed = "method1";
    } else if (input.landShareSqm > 0 && landPricePerSqm > 0) {
      estimatedTotal = existingUnits * (input.landShareSqm * landPricePerSqm) / 0.65 * 0.90;
      priorAsset.methodUsed = "대지지분역산";
    } else if (priorAsset.method2) {
      estimatedTotal = priorAsset.method2;
      priorAsset.methodUsed = "method2";
    } else {
      estimatedTotal = existingUnits * (input.purchasePrice / 1.3);
      priorAsset.methodUsed = "fallback";
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

  return { overrides, priorAsset };
}

/**
 * API 데이터로 Zone 상수를 오버라이드한 유효 파라미터 세트
 * DB 값이 fallback, 실시간 API 값이 우선
 */
function resolveZoneParams(
  z: ZoneData,
  market: MarketData,
  desiredPyung: number,
  stagePercentiles: StagePercentilesCache,
) {
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

  // ── 착공까지 기간: 공표월 → DB 백분위 → 단계별 통계 fallback
  const stagePctForStage: StagePercentileData | null = (() => {
    if (z.project_stage === 'management_disposal')    return stagePercentiles.management_disposal;
    if (z.project_stage === 'project_implementation') return stagePercentiles.project_implementation;
    if (z.project_stage === 'zone_designation')       return stagePercentiles.zone_designation;
    return null;
  })();
  const monthsDerived = deriveMonthsToConstruction(
    z.project_stage,
    z.construction_start_announced_ym,
    stagePctForStage,
    z.sigungu,
    z.project_type,
  );
  const months_to_construction_start = monthsDerived.value;
  const months_p25 = monthsDerived.p25;
  const months_p75 = monthsDerived.p75;
  const months_to_construction_source = monthsDerived.source;

  // ── 조합원 분양가: 공표/수동 입력값 있으면 그대로, 없으면 지역별 할인율 × p_base 추정
  const memberSaleDerived = deriveMemberSalePrice(
    z.member_sale_price_per_pyung,
    z.member_sale_price_source,
    p_base,       // API에서 갱신된 p_base 기준
    z.sigungu,    // 지역별 차등 할인율
  );
  const member_sale_price_per_pyung = memberSaleDerived.value;
  const member_sale_price_source = memberSaleDerived.source;

  // ── 볼린저 밴드 trend 데이터: nearbyNewAptPrice 우선, 없으면 localPrice
  const trendSlopePerMonth = nearbyOk
    ? (market.nearbyNewAptPrice!.trendSlopePerMonth ?? 0)
    : (molitOk ? (market.localPrice!.trendSlopePerMonth ?? 0) : 0);
  const monthlyStdDev = nearbyOk
    ? (market.nearbyNewAptPrice!.monthlyStdDev ?? 0)
    : (molitOk ? (market.localPrice!.monthlyStdDev ?? 0) : 0);

  // 신축 총연면적 역산: 기존연면적(건축물대장) ÷ 기존용적률 = 대지면적 → × 신축용적률
  // (건축물대장 API가 반환하는 값은 기존 건물 연면적 — 신축 계획 연면적과 다름)
  let _derivedSiteAreaSqm: number | null = null;
  let _existingFAR: number | null = null;
  let total_floor_area = z.total_floor_area; // DB fallback

  const bfa = market.buildingFloorArea;
  if (bfa?.fromApi && bfa.totalFloorArea > 0 && bfa.floorAreaRatio && bfa.floorAreaRatio > 0
      && z.floor_area_ratio_new && z.floor_area_ratio_new > 0) {
    _existingFAR = bfa.floorAreaRatio;
    _derivedSiteAreaSqm = bfa.totalFloorArea / (bfa.floorAreaRatio / 100);
    total_floor_area = _derivedSiteAreaSqm * (z.floor_area_ratio_new / 100);
  } else if (z.zone_area_sqm && z.floor_area_ratio_new) {
    // 건축물대장 없으면 구역면적 × 신축용적률 fallback
    total_floor_area = z.zone_area_sqm * (z.floor_area_ratio_new / 100);
  }

  // ── 단계 경과 개월 계산 — construction_start_announced_ym 없을 때 stage 날짜로 보정
  const stageToDateMap: Record<string, string | null | undefined> = {
    zone_designation:       z.zone_designation_date,
    project_implementation: z.project_implementation_date,
    management_disposal:    z.management_disposal_date,
    relocation:             z.management_disposal_date, // 이주는 관리처분 이후
    construction_start:     z.construction_start_date,
  };
  const stageStartDateRaw = stageToDateMap[z.project_stage] ?? null;
  let stageElapsedMonths: number | null = null;
  const monthsToConstructionRaw = months_to_construction_start;
  let months_to_construction_adjusted = months_to_construction_start;
  let months_p25_adjusted = months_p25;
  let months_p75_adjusted = months_p75;
  if (stageStartDateRaw && !z.construction_start_announced_ym) {
    const elapsed = Math.max(0, Math.round(
      (Date.now() - new Date(stageStartDateRaw).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    ));
    stageElapsedMonths = elapsed;
    months_to_construction_adjusted = Math.max(0, months_to_construction_start - elapsed);
    months_p25_adjusted = Math.max(0, months_p25 - elapsed);
    months_p75_adjusted = Math.max(0, months_p75 - elapsed);
  }

  // 조합원/일반분양 면적 계산
  // 방법 A: 평형별 세대수 × 공급면적 합산 → 조합원/일반 비율 분배
  // 세대수 데이터 없으면 fallback 없이 "missing" 처리 — UI에서 공란 표시
  const missingSaleAreaFields: string[] = [];
  let member_sale_area = z.member_sale_area;
  let general_sale_area = z.general_sale_area;
  let saleAreaSource: "calculated" | "db" | "missing" = "db";

  const hasSizeDist =
    (z.new_units_sale_u40 != null || z.new_units_sale_40_60 != null ||
     z.new_units_sale_60_85 != null || z.new_units_sale_85_135 != null || z.new_units_sale_o135 != null);

  if (hasSizeDist && z.planned_units_member && z.planned_units_general != null) {
    // 공급면적 대표값 (전용→공급 변환)
    // 구간   전용중간값  공급면적
    // u40    39㎡     → 53㎡
    // 40_60  59㎡     → 80㎡
    // 60_85  (74+84)/2=79㎡ → 104㎡
    // 85_135 114㎡    → 149㎡
    // o135   150㎡    → 196㎡
    const totalSaleArea =
      (z.new_units_sale_u40     ?? 0) * 53    +
      (z.new_units_sale_40_60   ?? 0) * 80    +
      (z.new_units_sale_60_85   ?? 0) * 104   +
      (z.new_units_sale_85_135  ?? 0) * 149   +
      (z.new_units_sale_o135    ?? 0) * 196;
    const totalUnits = z.planned_units_member + z.planned_units_general;
    const memberRatio = totalUnits > 0 ? z.planned_units_member / totalUnits : 1;
    member_sale_area  = totalSaleArea * memberRatio;
    general_sale_area = totalSaleArea * (1 - memberRatio);
    saleAreaSource = "calculated";
  } else {
    if (!hasSizeDist) missingSaleAreaFields.push('평형별세대수(new_units_sale_*)');
    if (!z.planned_units_member) missingSaleAreaFields.push('조합원세대수(planned_units_member)');
    if (z.planned_units_general == null) missingSaleAreaFields.push('일반분양세대수(planned_units_general)');
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
    months_to_construction_start: months_to_construction_adjusted,
    member_sale_price_per_pyung,
    total_floor_area,
    member_sale_area,
    general_sale_area,
    trendSlopePerMonth,
    monthlyStdDev,
    months_p25: months_p25_adjusted,
    months_p75: months_p75_adjusted,
    _derivedSiteAreaSqm,
    _existingFAR,
    _priorAssetMethodUsed: "",  // calculateAnalysis에서 priorAssetBreakdown 후 override
    _derivedSources: {
      monthsToConstruction: months_to_construction_source,
      memberSalePrice: member_sale_price_source,
      saleAreaSource,
      missingSaleAreaFields,
      stageElapsedMonths,
      stageStartDate: stageStartDateRaw ?? null,
      monthsToConstructionRaw,
    },
  };
}

// ─── 경기도 정비사업 현황 API — 실시간 단계 날짜 조회 ─────────────────────────

const GYEONGGI_CITIES = [
  "수원","성남","의정부","안양","부천","광명","평택","동두천","안산","고양",
  "과천","구리","남양주","오산","시흥","군포","의왕","하남","용인","파주",
  "이천","안성","김포","화성","광주","양주","포천","여주","연천","가평","양평",
];

function isGyeonggiSigungu(sigungu: string | null): boolean {
  if (!sigungu) return false;
  return GYEONGGI_CITIES.some(c => sigungu.includes(c));
}

function parseDateStr(d: string | null | undefined): string | null {
  if (!d) return null;
  const full = d.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const ym = d.match(/(\d{4})[.\-\/](\d{1,2})/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, "0")}-01`;
  return null;
}

/** 경기도 API에서 구역의 단계 날짜 조회 (null 필드만 반환) */
async function fetchGyeonggiStageDates(
  zoneName: string,
  sigungu: string | null,
): Promise<Pick<ZoneData,
  "zone_designation_date" | "association_approval_date" |
  "project_implementation_date" | "management_disposal_date" | "construction_start_date"
> | null> {
  const apiKey = process.env.GYEONGGI_OPEN_API_KEY ?? "6f7cae6f12fb49dea44a0f30e1611919";
  if (!isGyeonggiSigungu(sigungu)) return null;

  try {
    // 시 이름 추출 (예: "수원시 권선구" → "수원시")
    const sigunNm = sigungu?.match(/[가-힣]+시/)?.[0] ?? null;

    const params = new URLSearchParams({ KEY: apiKey, Type: "json", pIndex: "1", pSize: "100" });
    if (sigunNm) params.set("SIGUN_NM", sigunNm);

    const res = await fetch(`https://openapi.gg.go.kr/GenrlimprvBizpropls?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { GenrlimprvBizpropls?: unknown[] };
    const root = data?.GenrlimprvBizpropls ?? [];
    if (!Array.isArray(root) || root.length < 2) return null;

    type GRow = {
      IMPRV_ZONE_NM: string;
      IMPRV_ZONE_APPONT_FIRST_DE?: string | null;
      ASSOCTN_FOUND_CONFMTN_DE?: string | null;
      BIZ_IMPLMTN_CONFMTN_DE?: string | null;
      MANAGE_DISPOSIT_CONFMTN_DE?: string | null;
      STRCONTR_DE?: string | null;
    };
    const rows: GRow[] = ((root[1] as { row?: GRow[] }).row) ?? [];

    // 구역명 정규화 후 매칭
    const normalize = (n: string) =>
      n.replace(/\s+/g, "")
       .replace(/주택재건축정비사업조합?|주택재개발정비사업조합?|정비사업조합?/g, "")
       .toLowerCase();

    const zNorm = normalize(zoneName);
    const matched = rows.find(r => {
      const rNorm = normalize(r.IMPRV_ZONE_NM);
      const shorter = zNorm.length < rNorm.length ? zNorm : rNorm;
      return shorter.length >= 3 && (rNorm.includes(zNorm) || zNorm.includes(rNorm));
    });

    if (!matched) return null;

    return {
      zone_designation_date:       parseDateStr(matched.IMPRV_ZONE_APPONT_FIRST_DE),
      association_approval_date:   parseDateStr(matched.ASSOCTN_FOUND_CONFMTN_DE),
      project_implementation_date: parseDateStr(matched.BIZ_IMPLMTN_CONFMTN_DE),
      management_disposal_date:    parseDateStr(matched.MANAGE_DISPOSIT_CONFMTN_DE),
      construction_start_date:     parseDateStr(matched.STRCONTR_DE),
    };
  } catch {
    return null;
  }
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
  const { overrides: estimatedOverrides, priorAsset: priorAssetBreakdown } = estimateParamsForStage(baseZone, input, marketData);

  // Step 3: DB + 추정값 병합 (API 오버라이드 전 기준값)
  let zForApi: ZoneData = { ...baseZone, ...estimatedOverrides };

  // Step 3b: 단계 날짜 자동 보완 — 경기도 구역은 경기도 API에서 실시간 조회
  const needsDateFetch =
    !zForApi.zone_designation_date || !zForApi.project_implementation_date ||
    !zForApi.management_disposal_date || !zForApi.construction_start_date;
  if (needsDateFetch && zoneName) {
    const gyeonggiDates = await fetchGyeonggiStageDates(zoneName, zForApi.sigungu);
    if (gyeonggiDates) {
      zForApi = {
        ...zForApi,
        zone_designation_date:       zForApi.zone_designation_date       ?? gyeonggiDates.zone_designation_date,
        association_approval_date:   zForApi.association_approval_date   ?? gyeonggiDates.association_approval_date,
        project_implementation_date: zForApi.project_implementation_date ?? gyeonggiDates.project_implementation_date,
        management_disposal_date:    zForApi.management_disposal_date    ?? gyeonggiDates.management_disposal_date,
        construction_start_date:     zForApi.construction_start_date     ?? gyeonggiDates.construction_start_date,
      };
    }
  }

  // Step 4: 공시가 — 사용자 입력 우선, 없으면 NSDI 자동조회 결과 사용
  const effectiveOfficialValuation =
    input.officialValuation > 0
      ? input.officialValuation
      : (marketData.publicPrice?.officialPrice ?? 0);
  const effectiveInput = effectiveOfficialValuation !== input.officialValuation
    ? { ...input, officialValuation: effectiveOfficialValuation }
    : input;

  // Step 5: DB 단계별 소요기간 백분위 조회 (24h 캐시)
  const stagePercentiles = await fetchStagePercentiles();

  // Step 5b: API 데이터로 Zone 상수 오버라이드 (nearbyNewAptPrice → p_base/peak_local/neighbor)
  const apiResolved = resolveZoneParams(zForApi, marketData, input.desiredPyung, stagePercentiles) as ResolvedZoneData;
  apiResolved._priorAssetMethodUsed = priorAssetBreakdown.methodUsed;

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
        priorAssetMethod1: priorAssetBreakdown.method1,
        priorAssetMethod2: priorAssetBreakdown.method2,
        priorAssetMethod3: priorAssetBreakdown.method3,
        priorAssetMethodUsed: priorAssetBreakdown.methodUsed,
        new_units_sale_u40: baseZone.new_units_sale_u40,
        new_units_sale_40_60: baseZone.new_units_sale_40_60,
        new_units_sale_60_85: baseZone.new_units_sale_60_85,
        new_units_sale_85_135: baseZone.new_units_sale_85_135,
        new_units_sale_o135: baseZone.new_units_sale_o135,
        zone_area_sqm: baseZone.zone_area_sqm,
        floor_area_ratio_new: baseZone.floor_area_ratio_new,
        land_official_price_per_sqm: baseZone.land_official_price_per_sqm,
        stageElapsedMonths: resolvedZ._derivedSources.stageElapsedMonths,
        stageStartDate: resolvedZ._derivedSources.stageStartDate,
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
    monthsToConstruction: "announced" | "statistical" | "db_percentile";
    memberSalePrice: "announced" | "manual" | "cost_estimated";
    saleAreaSource: "calculated" | "db" | "missing";
    missingSaleAreaFields: string[];
    stageElapsedMonths: number | null;
    stageStartDate: string | null;
    monthsToConstructionRaw: number;  // 경과분 차감 전 원본값
  };
  /** 볼린저 밴드용 OLS 추세 (원/평/월). 0이면 데이터 없음 */
  trendSlopePerMonth: number;
  /** 볼린저 밴드 σ (원/평). 0이면 데이터 없음 */
  monthlyStdDev: number;
  /** 착공까지 기간 P25 (낙관 T 계산용) */
  months_p25: number;
  /** 착공까지 기간 P75 (비관 T 계산용) */
  months_p75: number;
  /** 신축 연면적 역산용: 역산 대지면적 (기존연면적 ÷ 기존용적률). null이면 역산 안 됨 */
  _derivedSiteAreaSqm: number | null;
  /** 신축 연면적 역산용: 건축물대장 기존 용적률 */
  _existingFAR: number | null;
  /** 종전자산 추정 방법 (debugParams 전달용) */
  _priorAssetMethodUsed: string;
};

function computeScenario(
  type: "optimistic" | "neutral" | "pessimistic",
  input: CalculationInput,
  z: ResolvedZoneData
): ScenarioResult {
  const { purchasePrice, purchaseLoanAmount, currentDeposit, desiredPyung, officialValuation } = input;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: 시나리오별 착공까지 기간 (monthsToStart) + 총 기간 T
  //
  // DB 백분위가 있으면 P25/P50/P75 사용, 없으면 기존 임의 가감 방식
  // ─────────────────────────────────────────────────────────────────────────
  let monthsToStart: number;
  if (type === "optimistic") {
    // P25: 빠른 25% 사례 (DB 실측) or 행정 기간 25% 단축
    monthsToStart = z.months_p25 > 0
      ? z.months_p25
      : Math.max(0, z.months_to_construction_start - z.t_admin_remaining * 0.25);
  } else if (type === "pessimistic") {
    // P75: 느린 75% 사례 (DB 실측) or 지연 가산
    monthsToStart = z.months_p75 > 0
      ? z.months_p75
      : z.months_to_construction_start + z.delay_conflict * 0.3;
  } else {
    monthsToStart = z.months_to_construction_start;
  }

  // 공사 기간은 시나리오에 따라 조정 (낙관 -10%, 비관 +20%)
  const BASE_CONSTRUCTION_MONTHS = z.base_project_months - z.months_to_construction_start;
  const constructionPeriodMonths = type === "optimistic"
    ? BASE_CONSTRUCTION_MONTHS * 0.90
    : type === "pessimistic"
    ? BASE_CONSTRUCTION_MONTHS * 1.20
    : BASE_CONSTRUCTION_MONTHS;

  const T = monthsToStart + constructionPeriodMonths;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: 일반 분양가 P_scenario (평당, 원) — 볼린저 밴드
  //
  // σ > 0 이면 OLS 추세 + ±2σ 밴드 방식 (Bollinger Band)
  // σ = 0 (데이터 없음) 이면 기존 방식 (peak 또는 mdd 기반)
  //
  // 일반분양은 '착공 시점' 전후에 이루어지므로 monthsToStart 기준 투영
  // ─────────────────────────────────────────────────────────────────────────
  const sigma = z.monthlyStdDev;
  const trendedPAtStart = z.p_base + z.trendSlopePerMonth * monthsToStart;

  let P: number;
  if (sigma > 0) {
    if (type === "optimistic") {
      P = trendedPAtStart + 2 * sigma;
      // peak가 있고 볼린저 상단보다 낮으면 peak×0.95로 조정 (보수 캡)
      if (z.peak_local > z.p_base) P = Math.min(P, z.peak_local * 0.95);
    } else if (type === "pessimistic") {
      // -2σ + 기준금리 충격(-8%) — 비관에서 금리 +2%p 상승 충격 가정
      P = (trendedPAtStart - 2 * sigma) * 0.92;
      P = Math.max(P, z.p_base * 0.55); // 극단 하한
    } else {
      P = trendedPAtStart;
    }
  } else {
    // 데이터 없을 때 기존 방식
    if (type === "optimistic") {
      P = z.peak_local > z.p_base ? z.peak_local * 0.95 : z.p_base * 1.15;
    } else if (type === "pessimistic") {
      P = Math.max(z.p_base * 0.8, z.p_base * (1 - z.mdd_local));
    } else {
      P = z.p_base;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2b: 입주 후 예상 시세 — T 전체 기간 기준으로 투영
  //   neighbor_new_apt_price = 현재 인근 신축 추정 시세 (희망 평형 기준)
  //   투영: + 추세 × T개월 ± 2σ × desiredPyung
  // ─────────────────────────────────────────────────────────────────────────
  // desiredPyung은 위 destructure에서 이미 선언됨
  let projectedNeighborPrice: number;
  if (z.neighbor_new_apt_price > 0 && sigma > 0) {
    const trendGain = z.trendSlopePerMonth * T * desiredPyung;
    if (type === "optimistic") {
      projectedNeighborPrice = z.neighbor_new_apt_price + trendGain + 2 * sigma * desiredPyung;
    } else if (type === "pessimistic") {
      projectedNeighborPrice = Math.max(
        (z.neighbor_new_apt_price + trendGain - 2 * sigma * desiredPyung) * 0.92,
        z.neighbor_new_apt_price * 0.65
      );
    } else {
      projectedNeighborPrice = z.neighbor_new_apt_price + trendGain;
    }
  } else {
    // 데이터 없으면 현재 시세 그대로 (기존 동작 유지)
    projectedNeighborPrice = z.neighbor_new_apt_price;
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
  let W = 0;

  if (type === "pessimistic") {
    // 지수평활 배제 — 최근 급등세 유지 + 지정학적 위기 프리미엄 가산
    appliedMonthlyRate = z.r_recent + z.alpha;
    C_T = C0 * Math.pow(1 + appliedMonthlyRate, T);
    W = 0;
  } else {
    W = Math.exp(-z.decay_factor * T);
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
  const baseBusinessExpense    = totalConstructionCost * (1 / 3); // 순수75%/기타25% 비율 → 기타 = 순수 × 1/3
  const financialCost          =
    totalConstructionCost * z.pf_loan_ratio * (z.annual_pf_rate / 12) * T;
  const totalCost = totalConstructionCost + baseBusinessExpense + financialCost;

  // ── 조합원분양가 결정 방식 ────────────────────────────────────────────────
  // Option A (zone_designation / association_established): 시세 × 할인율 추정 (resolveZoneParams에서 이미 계산)
  // Option B (project_implementation, 추정값): 목표 비례율(100%) 역산
  //   조합원분양가 = (목표비례율 × 종전자산 - 일반분양수입 + 총사업비) / 조합원면적
  const generalRevenue = P * generalSaleAreaPyung;
  let memberSalePricePerPyung = z.member_sale_price_per_pyung;
  let memberSalePriceMethod: "announced" | "manual" | "discount_estimated" | "prop_rate_inverse" = "discount_estimated";

  if (z.member_sale_price_source !== "cost_estimated") {
    // 확정값 또는 수동 입력: 그대로 사용
    memberSalePriceMethod = z.member_sale_price_source as "announced" | "manual";
  } else if (z.project_stage === "project_implementation" && memberSaleAreaPyung > 0 && z.total_appraisal_value > 0) {
    // Option B: 사업시행인가 단계 — 목표비례율(100%) 역산
    const targetPropRate = 1.0;
    memberSalePricePerPyung = Math.max(0,
      (targetPropRate * z.total_appraisal_value - generalRevenue + totalCost) / memberSaleAreaPyung
    );
    memberSalePriceMethod = "prop_rate_inverse";
  } else {
    // Option A: 구역지정 / 조합설립 단계 — 시세 × 할인율
    memberSalePriceMethod = "discount_estimated";
  }

  const memberRevenue  = memberSalePricePerPyung * memberSaleAreaPyung;
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
    estimatedPremium > 0 && projectedNeighborPrice > 0
      ? Math.log(1 + estimatedPremium / projectedNeighborPrice) /
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

  const netProfit             = projectedNeighborPrice - totalInvestmentCost;
  const netProfitAfterCosts   = projectedNeighborPrice - totalInvestmentWithCosts;

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
    { month: Math.round(T),              amount: projectedNeighborPrice + currentDeposit - contributionAtCompletion - purchaseLoanAmount },
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
  const maxAffordableContribution = projectedNeighborPrice - purchasePrice;

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
    monthsToConstructionSource: (type === "neutral" ? z._derivedSources.monthsToConstruction : "db_override") as "announced" | "statistical" | "db_percentile" | "db_override",
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
    calcBreakdown: {
      T: Math.round(T),
      monthsToStart: Math.round(monthsToStart),
      constructionMonths: Math.round(constructionPeriodMonths),
      C0: Math.round(C0),
      W: Math.round(W * 1000) / 1000,
      appliedMonthlyRate: Math.round(appliedMonthlyRate * 100000) / 100000,
      C_T: Math.round(C_T),
      existingFloorAreaSqm: (z._derivedSiteAreaSqm != null && z._existingFAR != null) ? Math.round(z._derivedSiteAreaSqm * (z._existingFAR / 100)) : null,
      existingFAR: z._existingFAR ?? null,
      derivedSiteAreaSqm: z._derivedSiteAreaSqm != null ? Math.round(z._derivedSiteAreaSqm) : null,
      newFAR: z.floor_area_ratio_new ?? null,
      totalFloorAreaPyung: Math.round(totalFloorAreaPyung * 10) / 10,
      generalSaleAreaPyung: Math.round(generalSaleAreaPyung * 10) / 10,
      memberSaleAreaPyung: Math.round(memberSaleAreaPyung * 10) / 10,
      pureCost: Math.round(totalConstructionCost),
      otherCost: Math.round(baseBusinessExpense),
      financialCost: Math.round(financialCost),
      totalCost: Math.round(totalCost),
      P: Math.round(P),
      memberSalePricePerPyung: Math.round(memberSalePricePerPyung),
      memberSalePriceMethod,
      memberRevenue: Math.round(memberRevenue),
      generalRevenue: Math.round(generalRevenue),
      totalRevenue: Math.round(totalRevenue),
      totalAppraisalValue: Math.round(z.total_appraisal_value),
      landOfficialPricePerSqm: z.land_official_price_per_sqm ?? null,
      priorAssetMethodUsed: z._priorAssetMethodUsed,
      stageElapsedMonths: z._derivedSources.stageElapsedMonths,
      monthsToStartRaw: z._derivedSources.monthsToConstructionRaw,
      zoneAreaSqm: z.zone_area_sqm ?? null,
      floorAreaRatioNew: z.floor_area_ratio_new ?? null,
      totalFloorAreaSqm: Math.round(z.total_floor_area),
      saleUnitsU40: z.new_units_sale_u40,
      saleUnitsC40_60: z.new_units_sale_40_60,
      saleUnitsC60_85: z.new_units_sale_60_85,
      saleUnitsC85_135: z.new_units_sale_85_135,
      saleUnitsO135: z.new_units_sale_o135,
      plannedUnitsMember: z.planned_units_member,
      plannedUnitsGeneral: z.planned_units_general,
      memberSaleRatio: (memberSaleAreaPyung + generalSaleAreaPyung) > 0
        ? Math.round(memberSaleAreaPyung / (memberSaleAreaPyung + generalSaleAreaPyung) * 1000) / 1000
        : null,
      memberSaleInverseGeneralRevenue: memberSalePriceMethod === "prop_rate_inverse" ? Math.round(generalRevenue) : null,
      memberSaleInverseTotalCost: memberSalePriceMethod === "prop_rate_inverse" ? Math.round(totalCost) : null,
      memberSaleInverseTotalAppraisal: memberSalePriceMethod === "prop_rate_inverse" ? Math.round(z.total_appraisal_value) : null,
      appraisalMethodDetail:
        landShareSqm > 0 && z.land_official_price_per_sqm ? "대지지분+공시지가" :
        officialValuation > 0 ? "공시가×감평율" : "매수가÷1.3",
    },
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

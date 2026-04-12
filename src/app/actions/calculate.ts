"use server";

import { createClient } from "@/lib/supabase/server";

// ── 입력 타입 ────────────────────────────────────────────────────────────────

export interface CalculationInput {
  zoneId: string;
  propertyType: string;       // 'villa' | 'house'
  purchasePrice: number;      // 매수 희망가 (원)
  currentDeposit: number;     // 현재 전/월세 보증금 (원)
  desiredPyung: number;       // 희망 조합원 분양 평형 (평)
  officialValuation: number;  // 공동주택 공시가격 (원)
}

// ── 시나리오별 출력 타입 ──────────────────────────────────────────────────────

export interface ScenarioResult {
  scenarioType: "optimistic" | "neutral" | "pessimistic";
  scenarioLabel: string;
  appliedMonths: number;
  appliedConstructionCostPerPyung: number;
  appliedGeneralSalePrice: number;
  estimatedAppraisalValue: number;
  estimatedPremium: number;
  premiumBubbleIndex: number;
  proportionalRate: number;
  rightsValue: number;
  additionalContribution: number;
  totalInvestmentCost: number;
  actualInitialInvestment: number;
  netProfit: number;
  returnOnEquity: number;
  breakEvenGeneralSalePrice: number;
  cushionAgainstCostIncrease: number;
}

export interface CalculationResult {
  zoneId: string;
  zoneName: string;
  input: CalculationInput;
  optimistic: ScenarioResult;
  neutral: ScenarioResult;
  pessimistic: ScenarioResult;
  calculatedAt: string;
}

// ── DB 타입 ───────────────────────────────────────────────────────────────────

interface ZoneData {
  zone_id: string;
  avg_appraisal_rate: number;
  base_project_months: number;
  t_admin_remaining: number;
  delay_conflict: number;
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
}

// ── 메인 계산 함수 ────────────────────────────────────────────────────────────

export async function calculateAnalysis(
  input: CalculationInput
): Promise<{ data: CalculationResult | null; error: string | null }> {
  const supabase = await createClient();

  // 1. 구역 데이터 조회
  const { data: zone, error: dbError } = await supabase
    .from("zones_data")
    .select("*")
    .eq("zone_id", input.zoneId)
    .single();

  if (dbError || !zone) {
    return { data: null, error: "해당 구역 데이터를 찾을 수 없습니다." };
  }

  const z = zone as ZoneData;

  // 2. 시나리오별 계산
  const optimistic = computeScenario("optimistic", input, z);
  const neutral    = computeScenario("neutral", input, z);
  const pessimistic = computeScenario("pessimistic", input, z);

  // 3. 구역명 가져오기
  const { zones } = await import("@/data/zones");
  const zoneName = zones[input.zoneId] ?? input.zoneId;

  const result: CalculationResult = {
    zoneId: input.zoneId,
    zoneName,
    input,
    optimistic,
    neutral,
    pessimistic,
    calculatedAt: new Date().toISOString(),
  };

  return { data: result, error: null };
}

// ── 시나리오별 계산 로직 ──────────────────────────────────────────────────────

function computeScenario(
  type: "optimistic" | "neutral" | "pessimistic",
  input: CalculationInput,
  z: ZoneData
): ScenarioResult {
  const {
    purchasePrice, currentDeposit, desiredPyung, officialValuation,
  } = input;

  // ── Step 1: T_scenario (사업 기간) ──
  let T: number;
  if (type === "optimistic") {
    T = z.base_project_months - z.t_admin_remaining * 0.25;
  } else if (type === "pessimistic") {
    T = z.base_project_months + z.delay_conflict;
  } else {
    T = z.base_project_months;
  }

  // ── Step 2: P_scenario (일반 분양가) ──
  let P: number;
  if (type === "optimistic") {
    P = z.peak_local * 0.95;
  } else if (type === "pessimistic") {
    P = z.p_base * (1 - z.mdd_local);
  } else {
    P = z.p_base;
  }

  // ── Step 3: C_T (평당 공사비 — 지수평활법) ──
  const C0 = z.current_construction_cost;
  let C_T: number;

  if (type === "pessimistic") {
    // 지수평활법 배제, 최근 급등세 + 위기 프리미엄
    C_T = C0 * Math.pow(1 + z.r_recent + z.alpha, T);
  } else {
    let W = Math.exp(-z.decay_factor * T);
    if (type === "optimistic") W = W * 0.5; // 물가 안정화 가속
    const r_adj = W * z.r_recent + (1 - W) * z.r_long;
    C_T = C0 * Math.pow(1 + r_adj, T);
  }

  // ── Core Formula 15단계 ──

  // 1. 예상 감정평가액
  const estimatedAppraisalValue = officialValuation * z.avg_appraisal_rate;

  // 2. 순수 건축비 (총 연면적은 ㎡ → 평 환산: 1평 = 3.3058㎡)
  const totalFloorAreaPyung = z.total_floor_area / 3.3058;
  const totalConstructionCost = C_T * totalFloorAreaPyung;

  // 3. 기타사업비 (건축비의 15%)
  const baseBusinessExpense = totalConstructionCost * 0.15;

  // 4. 누적 금융비용
  const financialCost =
    totalConstructionCost * z.pf_loan_ratio * (z.annual_pf_rate / 12) * T;

  // 5. 총 사업비
  const totalCost = totalConstructionCost + baseBusinessExpense + financialCost;

  // 6. 구역 총수입 (분양면적도 ㎡ → 평 환산)
  const generalSaleAreaPyung = z.general_sale_area / 3.3058;
  const memberSaleAreaPyung  = z.member_sale_area / 3.3058;
  const totalRevenue =
    P * generalSaleAreaPyung +
    z.member_sale_price_per_pyung * memberSaleAreaPyung;

  // 7. 비례율
  const proportionalRate =
    ((totalRevenue - totalCost) / z.total_appraisal_value) * 100;

  // 8. 권리가액
  const rightsValue = estimatedAppraisalValue * (proportionalRate / 100);

  // 9. 예상 프리미엄
  const estimatedPremium = purchasePrice - estimatedAppraisalValue;

  // 10. 대상 분양가 (희망 평형 × 평당 조합원 분양가)
  const targetMemberSalePrice = desiredPyung * z.member_sale_price_per_pyung;

  // 11. 추가 분담금 (음수면 환급)
  const additionalContribution = targetMemberSalePrice - rightsValue;

  // 12. 총 투자 원금
  const totalInvestmentCost = purchasePrice + additionalContribution;

  // 13. 초기 실투자금
  const actualInitialInvestment = purchasePrice - currentDeposit;

  // 14. 순수익
  const netProfit = z.neighbor_new_apt_price - totalInvestmentCost;

  // 15. 투자 수익률 (ROE)
  const returnOnEquity =
    actualInitialInvestment > 0
      ? (netProfit / actualInitialInvestment) * 100
      : 0;

  // ── 추가 지표 ──

  // 손익분기 일반 분양가 (netProfit = 0이 되는 P)
  // neighbor_new_apt_price = P_break * generalSaleAreaPyung + memberRevenue - totalCostExcludingP
  // → P_break = (neighbor + totalCostExcludingP - memberRevenue) / generalSaleAreaPyung
  const memberRevenue = z.member_sale_price_per_pyung * memberSaleAreaPyung;
  const totalCostExcludingGeneralRevenue = totalCost;
  const breakEvenGeneralSalePrice =
    generalSaleAreaPyung > 0
      ? (z.neighbor_new_apt_price +
          totalCostExcludingGeneralRevenue -
          memberRevenue +
          purchasePrice +
          targetMemberSalePrice -
          z.neighbor_new_apt_price) /
        generalSaleAreaPyung
      : 0;

  // 공사비 쿠션 (순수익이 0이 될 때까지 버틸 수 있는 평당 공사비 한계치)
  // totalInvestmentCost = neighbor → additionalContribution = neighbor - purchasePrice
  // rightsValue = targetMemberSalePrice - (neighbor - purchasePrice)
  // rightsValue = estimatedAppraisalValue × (proportionalRate_new / 100)
  // 역산이 복잡하므로 근사값: 현재 C_T에서 netProfit / totalFloorAreaPyung 만큼 여유
  const cushionAgainstCostIncrease =
    totalFloorAreaPyung > 0
      ? C_T + netProfit / totalFloorAreaPyung
      : C_T;

  // 프리미엄 버블 지수
  const premiumBubbleIndex =
    estimatedAppraisalValue > 0
      ? (estimatedPremium / estimatedAppraisalValue) * 100
      : 0;

  const LABELS = {
    optimistic: "낙관 시나리오",
    neutral: "중립 시나리오",
    pessimistic: "비관 시나리오",
  };

  return {
    scenarioType: type,
    scenarioLabel: LABELS[type],
    appliedMonths: Math.round(T),
    appliedConstructionCostPerPyung: Math.round(C_T),
    appliedGeneralSalePrice: Math.round(P),
    estimatedAppraisalValue: Math.round(estimatedAppraisalValue),
    estimatedPremium: Math.round(estimatedPremium),
    premiumBubbleIndex: Math.round(premiumBubbleIndex * 10) / 10,
    proportionalRate: Math.round(proportionalRate * 10) / 10,
    rightsValue: Math.round(rightsValue),
    additionalContribution: Math.round(additionalContribution),
    totalInvestmentCost: Math.round(totalInvestmentCost),
    actualInitialInvestment: Math.round(actualInitialInvestment),
    netProfit: Math.round(netProfit),
    returnOnEquity: Math.round(returnOnEquity * 10) / 10,
    breakEvenGeneralSalePrice: Math.round(breakEvenGeneralSalePrice),
    cushionAgainstCostIncrease: Math.round(cushionAgainstCostIncrease),
  };
}

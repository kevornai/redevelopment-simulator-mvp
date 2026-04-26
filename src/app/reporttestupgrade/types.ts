/**
 * 분석 리포트 사용자 입력값 타입
 * calculate.ts 등 연산 모듈과 완전히 독립
 */

export interface UserInput {
  zoneId: string;
  projectType: "reconstruction" | "redevelopment";
  propertyType: "apartment" | "villa" | "house";

  /** 매수 희망가 (원) */
  purchasePrice: number;
  /** 매수 시 대출금 (원) */
  purchaseLoanAmount: number;
  /** 현재 전/월세 보증금 (원) */
  currentDeposit: number;

  /** 희망 조합원 분양 평형 */
  desiredPyung: number;

  /** 공동주택 공시가격 (원) — 0이면 미입력 */
  officialValuation: number;

  /** 대지지분 (㎡) — 재건축 전용 */
  landShareSqm: number;
}

// ─── 1단계: 구역 기본 정보 ────────────────────────────────────────────────────

export interface UnitsByCategory {
  u40:    number | null;
  c40_60: number | null;
  c60_85: number | null;
  c85_135: number | null;
  o135:   number | null;
}

// 단계 목록 (순서 중요)
export const STAGE_DEFINITIONS = [
  { key: "zone_designation",       label: "정비구역 지정",    field: "dateZoneDesignation" },
  { key: "promo_committee",        label: "추진위원회 승인",   field: "datePromoCommittee"  },
  { key: "association_established",label: "조합설립 인가",    field: "dateAssociation"     },
  { key: "project_implementation", label: "사업시행 인가",    field: "dateProjectImpl"     },
  { key: "management_disposal",    label: "관리처분 인가",    field: "dateMgmtDisposal"    },
  { key: "construction_start",     label: "착공",            field: "dateConstruction"    },
  { key: "general_sale",           label: "일반분양",         field: "dateGeneralSale"     },
  { key: "completion",             label: "준공",            field: "dateCompletion"      },
] as const;

export type StageDateField =
  | "dateZoneDesignation"
  | "datePromoCommittee"
  | "dateAssociation"
  | "dateProjectImpl"
  | "dateMgmtDisposal"
  | "dateConstruction"
  | "dateGeneralSale"
  | "dateCompletion";

export interface Step1Data {
  // 코드
  lawdCd:   string | null;
  bjdCode:  string | null;

  // 평형별 세대수
  existingUnits: UnitsByCategory;
  newUnits:      UnitsByCategory;

  // 용적률
  farExisting: number | null;
  farNew:      number | null;

  // 면적
  zoneSqm:           number | null;
  buildingFloorArea: number | null;

  // 단계별 날짜 (모두 YYYY-MM-DD or null, 편집 가능)
  dateZoneDesignation: string | null;
  datePromoCommittee:  string | null;
  dateAssociation:     string | null;
  dateProjectImpl:     string | null;
  dateMgmtDisposal:    string | null;
  dateConstruction:    string | null;
  dateGeneralSale:     string | null;
  dateCompletion:      string | null;

  // 공시가격 (브이월드 API 자동 조회)
  officialPrice:         number | null;
  officialPriceApiError: string | null;   // null이면 API 성공

  // 대지지분 (건축물대장 platArea 기반 자동 계산)
  landShareSqm:       number | null;
  landSharePlatArea:  number | null;  // 계산에 사용된 platArea
  landShareTotalUnits: number | null; // 계산에 사용된 세대수
  landShareUnitSqm:   number;         // 계산에 사용된 전용면적 (기본 59㎡)

  // 예상 조합원 분양가 (수동 입력)
  memberSalePricePerPyung: number | null;

  // 공사비
  constructionCostPerPyung: number | null;
  constructionTier:         string | null;
  kosisIndex:               number | null;
}

// ─── 2단계: 사업성 분석 (중립 시나리오) ──────────────────────────────────────

export interface Step2Data {
  // ① 종전자산평가액
  appraisalUnits:       number;        // 기존 세대수
  appraisalOfficialPrice: number;      // 공시가 (step1에서)
  totalAppraisalValue:  number | null; // = appraisalUnits × officialPrice × 1.4

  // ② 일반분양가 p_base (MOLIT API)
  pBase:         number | null;
  pBaseApiError: string | null;

  // 신축연면적 계산 과정
  buildingFloorAreaUsed: number | null; // 기존연면적 (건축물대장)
  farExistingUsed:       number | null; // 기존용적률
  platAreaUsed:          number | null; // platArea (있으면 우선)
  derivedSiteArea:       number | null; // 역산 대지면적
  farNewUsed:            number | null; // 신축용적률
  newFloorAreaSqm:          number | null; // 신축 분양연면적 (㎡, 용적률 기준 지상)
  newFloorAreaPyung:        number | null; // 신축 분양연면적 (평)
  constructionFloorAreaSqm:   number | null; // 공사연면적 (㎡, 지하주차장+커뮤니티 포함)
  constructionFloorAreaPyung: number | null; // 공사연면적 (평)
  constructionAreaMultiplier: number;        // 지상→공사 배율 (기본 1.5)

  // 분양면적
  generalSaleAreaSqm:   number | null;
  generalSaleAreaPyung: number | null;
  memberSaleAreaSqm:    number | null;
  memberSaleAreaPyung:  number | null;

  // ② 일반분양수익
  generalRevenue: number | null;

  // ③ 조합원분양수익
  memberSalePricePerPyung: number | null; // 중립 할인율 적용 (또는 확정값)
  memberSaleDiscountRate:  number | null; // 적용 할인율 (cost_estimated 시)
  memberRevenue:           number | null;
  totalRevenue:            number | null;

  // ④ 총사업비
  constructionCostPerPyung: number | null; // C0 (step1)
  pureCost:      number | null;
  otherCostRate: number;                   // 기본 0.30
  otherCost:     number | null;
  pfLoanRatio:   number;                   // 기본 0.50
  pfAnnualRate:  number;                   // 기본 0.065
  projectMonths: number;                   // 기본 60
  financialCost: number | null;
  totalCost:     number | null;

  // ⑤ 비례율
  proportionalRate: number | null; // %

  // ⑥ 분담금 (중립, 개인)
  desiredPyung:             number;
  personalAppraisalValue:   number | null; // officialPrice × 1.4
  rightsValue:              number | null; // personalAppraisalValue × proportionalRate/100
  memberSaleTotalForUnit:   number | null; // memberSalePricePerPyung × desiredPyung
  contribution:             number | null; // memberSaleTotal - rightsValue
}

export const DEFAULT_USER_INPUT: UserInput = {
  zoneId: "",
  projectType: "reconstruction",
  propertyType: "apartment",
  purchasePrice: 300_000_000,
  purchaseLoanAmount: 200_000_000,
  currentDeposit: 0,
  desiredPyung: 18,
  officialValuation: 0,
  landShareSqm: 0,
};

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

  // 공사비
  constructionCostPerPyung: number | null;
  constructionTier:         string | null;
  kosisIndex:               number | null;
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

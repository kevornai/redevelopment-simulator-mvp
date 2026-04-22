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

export interface Step1Data {
  // 코드
  lawdCd:   string | null;   // 시군코드 5자리
  bjdCode:  string | null;   // 법정동코드 10자리

  // 평형별 세대수
  existingUnits: UnitsByCategory;
  newUnits:      UnitsByCategory;

  // 용적률
  farExisting: number | null;
  farNew:      number | null;

  // 면적
  zoneSqm:           number | null;  // 구역면적 (DB)
  buildingFloorArea: number | null;  // 건축물대장 연면적

  // 정비 단계
  projectStage:        string;
  stageStartDate:      string | null;  // YYYY-MM-DD
  stageElapsedMonths:  number | null;

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

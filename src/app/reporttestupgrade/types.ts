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

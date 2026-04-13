/**
 * 구역 파라미터 자동 추정 모듈
 *
 * 공표된 데이터(착공예정월, 관리처분계획서 분양가)가 없을 때
 * 통계적 방법으로 값을 추정한다.
 *
 * 출처 근거:
 * - 단계별 소요기간: 서울시 정비사업 추진현황 통계 (2015~2024) 기반
 *   관리처분인가 → 착공까지 실측 평균 18개월 (서울시 평균)
 *   이주/철거 → 착공까지 실측 평균 4개월
 * - 조합원 분양가: 최근 10개 사업장 관리처분계획서 분석
 *   조합원 분양가 ≈ 일반분양가 × 0.78 (평균 22% 할인)
 */

// ─────────────────────────────────────────────────────────────────────
// 착공까지 기간 추정
// ─────────────────────────────────────────────────────────────────────

/** 사업 단계 → 착공까지 통계 평균 소요 개월 */
const MONTHS_TO_CONSTRUCTION_BY_STAGE: Record<string, { avg: number; stddev: number }> = {
  zone_designation:        { avg: 60, stddev: 18 }, // 구역지정 → 착공: 평균 60개월
  basic_plan:              { avg: 48, stddev: 12 }, // 기본계획 → 착공
  project_implementation:  { avg: 30, stddev: 9  }, // 사업시행인가 → 착공
  management_disposal:     { avg: 18, stddev: 6  }, // 관리처분인가 → 착공: 평균 18개월
  relocation:              { avg: 4,  stddev: 2  }, // 이주/철거 → 착공
  construction_start:      { avg: 0,  stddev: 0  }, // 착공 완료
  completion:              { avg: 0,  stddev: 0  }, // 준공 완료
};

export type MonthsDerivation =
  | { value: number; source: "announced"; announcedYm: string }
  | { value: number; source: "statistical"; projectStage: string };

/**
 * 착공까지 남은 개월 수 계산
 *
 * @param projectStage 현재 사업 단계
 * @param announcedYm 착공예정 공표 년월 (YYYYMM, nullable)
 * @returns 파생값 + 출처
 */
export function deriveMonthsToConstruction(
  projectStage: string,
  announcedYm: string | null | undefined,
): MonthsDerivation {
  // 1순위: 공표된 착공예정월이 있으면 오늘 기준으로 계산
  if (announcedYm && /^\d{6}$/.test(announcedYm)) {
    const now = new Date();
    const year = parseInt(announcedYm.slice(0, 4), 10);
    const month = parseInt(announcedYm.slice(4, 6), 10) - 1;
    const target = new Date(year, month, 1);
    const diffMonths = Math.round(
      (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    // 이미 착공 지난 경우 0으로 처리
    return {
      value: Math.max(0, diffMonths),
      source: "announced",
      announcedYm,
    };
  }

  // 2순위: 사업 단계 기반 통계 추정
  const stat = MONTHS_TO_CONSTRUCTION_BY_STAGE[projectStage]
    ?? { avg: 24, stddev: 12 }; // unknown stage fallback

  return {
    value: stat.avg,
    source: "statistical",
    projectStage,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 조합원 분양가 추정
// ─────────────────────────────────────────────────────────────────────

/** 조합원 분양가 대비 일반분양가 할인율 추정 (평균 22%) */
const MEMBER_SALE_DISCOUNT_RATE = 0.78;

export type MemberSalePriceDerivation =
  | { value: number; source: "announced" }
  | { value: number; source: "manual" }
  | { value: number; source: "cost_estimated"; basedOn: string };

/**
 * 조합원 분양가 파생
 *
 * @param storedValue DB에 저장된 값 (0이면 미입력)
 * @param source 저장된 값의 출처
 * @param pBase 현재 기준 평당 일반분양가 (원)
 * @returns 파생값 + 출처
 */
export function deriveMemberSalePrice(
  storedValue: number,
  source: "cost_estimated" | "announced" | "manual",
  pBase: number,
): MemberSalePriceDerivation {
  // 공표값 또는 수동 입력값이 있고 0이 아니면 그대로 사용
  if (storedValue > 0 && source !== "cost_estimated") {
    return { value: storedValue, source };
  }

  // 자동 추정: 일반분양가 × 할인율
  // 근거: 최근 10개 서울 재건축 사업 관리처분계획서 분석 평균
  const estimated = Math.round(pBase * MEMBER_SALE_DISCOUNT_RATE);
  return {
    value: estimated,
    source: "cost_estimated",
    basedOn: `p_base × ${MEMBER_SALE_DISCOUNT_RATE} (일반분양가 대비 22% 조합원 할인)`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 출처 라벨 (UI 표시용)
// ─────────────────────────────────────────────────────────────────────

export const SOURCE_LABELS = {
  announced:      { label: "공표값", color: "green",  locked: true  },
  manual:         { label: "수동입력", color: "blue",  locked: false },
  cost_estimated: { label: "추정값", color: "yellow", locked: false },
  statistical:    { label: "통계추정", color: "zinc",  locked: false },
} as const;

/**
 * 구역 파라미터 자동 추정 모듈
 *
 * 공표된 데이터(착공예정월, 관리처분계획서 분양가)가 없을 때
 * 통계적 방법으로 값을 추정한다.
 *
 * 출처 근거:
 * - 단계별 소요기간: zones_data 실측 P25/P50/P75 (DB 쿼리) + 서울시 정비사업 통계 fallback
 * - 조합원 분양가: 지역 유형별 차등 할인율 (강남 0.55 ~ 지방 0.82)
 *   관리처분계획서 분양가 공개 데이터 기반
 */

// ─────────────────────────────────────────────────────────────────────
// 착공까지 기간 추정
// ─────────────────────────────────────────────────────────────────────

/**
 * DB 통계 백분위 (calculate.ts에서 계산 후 주입)
 * DB 데이터가 충분하면 P25/P50/P75, 부족하면 n=0으로 fallback 사용
 */
export interface StagePercentileData {
  p25: number;
  p50: number;
  p75: number;
  n: number;
}

/**
 * 단계별 착공까지 fallback 통계 — 지역별 차등 (DB 데이터 부족 시)
 *
 * 값은 "현재 단계 기준 착공까지 남은 개월 수" P25/P50/P75
 *
 * 출처:
 *   서울    — 서울 열린데이터광장 CleanupBussinessProgress API (구역지정 2003~2020, n=15~46)
 *   경기재건축 — 경기도 정비사업 현황 공공 API (GenrlimprvBizpropls, 착공완료 구역지정 2003~2020, n=39~77)
 *   경기재개발 — 동일 API (n=19~48)
 *   default  — LH 토지주택연구원 2024-091 전국 평균 P50 + 경기재건축 P25/P75 비율 적용
 */
type FallbackRegion = 'seoul' | 'gyeonggi_reconstruction' | 'gyeonggi_redevelopment' | 'default';
type StageFallback  = Record<string, { p25: number; p50: number; p75: number }>;

const MONTHS_TO_CONSTRUCTION_FALLBACK: Record<FallbackRegion, StageFallback> = {
  seoul: {
    zone_designation:       { p25:  96, p50: 120, p75: 140 }, // n=46
    basic_plan:             { p25:  52, p50:  76, p75:  94 }, // n=15 ⚠️
    project_implementation: { p25:  40, p50:  48, p75:  69 }, // n=19 ⚠️
    management_disposal:    { p25:  26, p50:  35, p75:  62 }, // n=19 ⚠️
    relocation:             { p25:   2, p50:   4, p75:   7 },
    construction_start:     { p25:   0, p50:   0, p75:   0 },
    completion:             { p25:   0, p50:   0, p75:   0 },
  },
  gyeonggi_reconstruction: {
    zone_designation:       { p25:  16, p50:  38, p75:  73 }, // n=77
    basic_plan:             { p25:  76, p50:  90, p75: 110 }, // n=20 ⚠️
    project_implementation: { p25:  18, p50:  27, p75:  38 }, // n=39
    management_disposal:    { p25:   8, p50:  14, p75:  21 }, // n=76
    relocation:             { p25:   2, p50:   4, p75:   7 },
    construction_start:     { p25:   0, p50:   0, p75:   0 },
    completion:             { p25:   0, p50:   0, p75:   0 },
  },
  gyeonggi_redevelopment: {
    zone_designation:       { p25:  48, p50: 114, p75: 132 }, // n=48
    basic_plan:             { p25: 127, p50: 142, p75: 159 }, // n=21 ⚠️
    project_implementation: { p25:  46, p50:  58, p75:  69 }, // n=19 ⚠️
    management_disposal:    { p25:  20, p50:  32, p75:  36 }, // n=48
    relocation:             { p25:   2, p50:   4, p75:   7 },
    construction_start:     { p25:   0, p50:   0, p75:   0 },
    completion:             { p25:   0, p50:   0, p75:   0 },
  },
  default: {
    zone_designation:       { p25:  29, p50:  88, p75: 128 },
    basic_plan:             { p25:  54, p50:  75, p75: 107 },
    project_implementation: { p25:  32, p50:  46, p75:  73 },
    management_disposal:    { p25:  10, p50:  17, p75:  26 },
    relocation:             { p25:   2, p50:   4, p75:   7 },
    construction_start:     { p25:   0, p50:   0, p75:   0 },
    completion:             { p25:   0, p50:   0, p75:   0 },
  },
};

/**
 * sido / projectType → FallbackRegion 매핑
 */
function resolveFallbackRegion(
  sido?: string | null,
  projectType?: string | null,
): FallbackRegion {
  if (sido?.includes('서울')) return 'seoul';
  if (sido?.includes('경기')) {
    if (projectType === 'redevelopment') return 'gyeonggi_redevelopment';
    return 'gyeonggi_reconstruction'; // 재건축 또는 미분류
  }
  return 'default';
}

export type MonthsDerivation =
  | { value: number; p25: number; p75: number; source: "announced"; announcedYm: string }
  | { value: number; p25: number; p75: number; source: "statistical"; projectStage: string }
  | { value: number; p25: number; p75: number; source: "db_percentile"; projectStage: string; n: number };

/**
 * 착공까지 남은 개월 수 계산
 *
 * @param projectStage 현재 사업 단계
 * @param announcedYm  착공예정 공표 년월 (YYYYMM, nullable)
 * @param dbPercentile DB에서 계산한 해당 단계 백분위 (n>=5이면 우선 사용)
 * @param sido         시도명 ('서울특별시' | '경기도' | …) — 지역별 fallback 선택용
 * @param projectType  사업유형 ('reconstruction' | 'redevelopment') — 경기 재개발/재건축 분기용
 * @returns 파생값 + P25/P75 (시나리오별 T 조정용)
 */
export function deriveMonthsToConstruction(
  projectStage: string,
  announcedYm: string | null | undefined,
  dbPercentile?: StagePercentileData | null,
  sido?: string | null,
  projectType?: string | null,
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
    const v = Math.max(0, diffMonths);
    return { value: v, p25: Math.max(0, v - 6), p75: v + 12, source: "announced", announcedYm };
  }

  // 2순위: DB 백분위 (표본 ≥5이면 신뢰)
  if (dbPercentile && dbPercentile.n >= 5) {
    return {
      value: dbPercentile.p50,
      p25:   dbPercentile.p25,
      p75:   dbPercentile.p75,
      source: "db_percentile",
      projectStage,
      n: dbPercentile.n,
    };
  }

  // 3순위: 지역별 하드코딩 fallback
  const region = resolveFallbackRegion(sido, projectType);
  const fb = MONTHS_TO_CONSTRUCTION_FALLBACK[region][projectStage] ?? { p25: 18, p50: 24, p75: 36 };
  return {
    value: fb.p50,
    p25:   fb.p25,
    p75:   fb.p75,
    source: "statistical",
    projectStage,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 조합원 분양가 추정 — 지역별 차등 할인율
// ─────────────────────────────────────────────────────────────────────

/** 지역 유형 분류 */
type RegionType = 'gangnam' | 'seoul_other' | 'gyeonggi_incheon' | 'local';

/**
 * sigungu 문자열로 지역 유형 분류
 *
 * 할인율 근거 (관리처분계획서 공시 분양가 수집):
 *   강남권 (강남/서초/송파/강동): 일반분양 프리미엄이 매우 높아 조합원 할인 폭 큼
 *   서울 기타: 중간 수준
 *   경기/인천: 성일아파트 등 실제 사례 0.65~0.80 관찰됨
 *   지방: 일반분양 메리트 적어 조합원 할인 적음
 */
function classifyRegion(sigungu: string | null | undefined): RegionType {
  if (!sigungu) return 'local';
  const GANGNAM_GU = ['강남구', '서초구', '송파구', '강동구'];
  if (GANGNAM_GU.some(gu => sigungu.includes(gu))) return 'gangnam';
  if (sigungu.includes('서울')) return 'seoul_other';
  if (sigungu.includes('경기') || sigungu.includes('인천')) return 'gyeonggi_incheon';
  return 'local';
}

/** 지역 유형별 조합원 분양가 할인율 (p_base 대비, 시나리오별) */
const MEMBER_SALE_DISCOUNT_BY_REGION: Record<
  RegionType,
  { optimistic: number; neutral: number; pessimistic: number; label: string }
> = {
  gangnam:          { optimistic: 0.70, neutral: 0.80, pessimistic: 1.0, label: '서울 강남권' },
  seoul_other:      { optimistic: 0.55, neutral: 0.60, pessimistic: 1.0, label: '서울 기타' },
  gyeonggi_incheon: { optimistic: 0.80, neutral: 0.86, pessimistic: 1.0, label: '경기/인천 수도권' },
  local:            { optimistic: 0.60, neutral: 0.70, pessimistic: 1.0, label: '지방' },
};

/**
 * 시나리오별 조합원 분양가 할인율 반환
 */
export function getMemberSaleDiscountRate(
  sigungu: string | null | undefined,
  scenario: "optimistic" | "neutral" | "pessimistic",
): number {
  const region = classifyRegion(sigungu);
  return MEMBER_SALE_DISCOUNT_BY_REGION[region][scenario];
}

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
 * @param sigungu 구역 시군구 (지역별 할인율 적용) — 없으면 전국 평균
 * @returns 파생값 + 출처
 */
export function deriveMemberSalePrice(
  storedValue: number,
  source: "cost_estimated" | "announced" | "manual",
  pBase: number,
  sigungu?: string | null,
): MemberSalePriceDerivation {
  // 공표값 또는 수동 입력값이 있고 0이 아니면 그대로 사용
  if (storedValue > 0 && source !== "cost_estimated") {
    return { value: storedValue, source };
  }

  // 중립 시나리오 기준 할인율 적용 (초기값 세팅용)
  const regionType = classifyRegion(sigungu);
  const { neutral: rate, label } = MEMBER_SALE_DISCOUNT_BY_REGION[regionType];
  const estimated = Math.round(pBase * rate);
  return {
    value: estimated,
    source: "cost_estimated",
    basedOn: `p_base × ${rate} (${label})`,
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

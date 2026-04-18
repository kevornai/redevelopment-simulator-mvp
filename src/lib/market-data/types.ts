// 외부 API에서 수집한 시장 데이터 타입

export interface RateData {
  /** 한국은행 기준금리 (%) */
  baserate: number;
  /** 주택담보대출 가중평균금리 (%) */
  mortgageRate: number;
  /** PF 대출 추정 금리 = 기준금리 + 스프레드 (%) */
  pfRate: number;
  /** 목표 수익률 = 국고채 3년 + 위험 프리미엄 (%) */
  targetYield: number;
  /** 데이터 기준 년월 (YYYYMM) */
  basePeriod: string;
  /** API 실제 호출 여부 (false면 fallback 값) */
  fromApi: boolean;
}

export interface ConstructionCostData {
  /** 최근 36개월 월평균 공사비 인상률 (소수, 예: 0.007) */
  rRecent: number;
  /** 과거 120개월 월평균 공사비 인상률 (소수, 예: 0.002) */
  rLong: number;
  /** 현재 건설공사비지수 */
  currentIndex: number;
  /** 데이터 기준 년월 */
  basePeriod: string;
  fromApi: boolean;
}

export interface ApartmentTransaction {
  price: number;       // 만원
  area: number;        // ㎡
  pricePerPyung: number; // 원/평
  dealDate: string;    // YYYYMM
  floor: number;
  buildYear: number;
  aptName: string;
}

export interface LocalPriceData {
  /** 최근 12개월 신축(5년 이내) 중위 평당 거래가 (원) */
  medianNewAptPricePerPyung: number;
  /** 전체 기간 역대 최고 평당 거래가 (원) */
  peakPricePerPyung: number;
  /** 역사적 최대 낙폭 (소수, 예: 0.22) */
  mddRate: number;
  /** 최근 12개월 평균 거래가 기준 추정 시세 (희망 평형 기준, 원) */
  estimatedCurrentPrice: number;
  /** 법정동코드 */
  lawdCd: string;
  /** 데이터 기준 년월 */
  basePeriod: string;
  fromApi: boolean;
  /** OLS 선형 추세 — 월별 중위가 기준 (원/평/월). 데이터 부족 시 0 */
  trendSlopePerMonth: number;
  /** 볼린저 밴드용 월별 중위가 표준편차 (원/평). 데이터 부족 시 0 */
  monthlyStdDev: number;
}

export interface PublicPriceData {
  /** 공시가격 (원) */
  officialPrice: number;
  /** 공시가격 현실화율 추정 (%) — 국토부 발표 현실화율 */
  realizationRate: number;
  /** 추정 감정평가율 (공시가 대비, 소수) */
  estimatedAppraisalRate: number;
  fromApi: boolean;
}

export interface BuildingFloorData {
  totalFloorArea: number;
  floorAreaRatio: number | null;  // 현재 용적률 (API vlRat)
  buildingCount: number;
  fromApi: true;
}

/** 구축(20년+) 아파트 실거래 데이터 — 종전자산 역산용 */
export interface OldAptPriceData {
  /** 구축 아파트 중위 평당 거래가 (원/전용평) */
  medianPricePerPyung: number;
  /** 표본 수 */
  sampleCount: number;
  fromApi: boolean;
}

/** 계산 엔진에 주입되는 시장 데이터 전체 */
export interface MarketData {
  rates: RateData;
  constructionCost: ConstructionCostData;
  /** 구역 자체 물건(구축) 거래가 — 재개발 구역은 대부분 null */
  localPrice: LocalPriceData | null;
  /** 구역 인근 신축(5년 이내) 아파트 시세 — p_base/peak_local/neighbor 자동 산출용 */
  nearbyNewAptPrice: LocalPriceData | null;
  /** 구역 인근 구축(20년+) 아파트 시세 — 종전자산 2순위 역산용 */
  oldAptPrice: OldAptPriceData | null;
  publicPrice: PublicPriceData | null;
  /** 건축물대장 현재 연면적 — total_floor_area 추정 기초 데이터 */
  buildingFloorArea: BuildingFloorData | null;
  fetchedAt: string;
}

/** API 호출 결과 래퍼 */
export type ApiResult<T> = { data: T; error: null } | { data: null; error: string };

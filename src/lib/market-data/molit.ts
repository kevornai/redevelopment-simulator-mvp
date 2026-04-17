/**
 * 국토부 아파트매매 실거래가 API (data.go.kr)
 * serviceKey: MOLIT_API_KEY
 * Endpoint: RTMSDataSvcAptTradeDev
 *
 * 목적:
 *   - 최근 12개월 신축(5년 이내) 중위 평당 거래가 → medianNewAptPricePerPyung
 *   - 전체 기간 역대 최고 평당 거래가 → peakPricePerPyung
 *   - 역사적 최대 낙폭 → mddRate
 *   - 희망 평형 기준 추정 현재 시세 → estimatedCurrentPrice
 */

import type { ApiResult, ApartmentTransaction, LocalPriceData } from './types';

const MOLIT_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

interface MolitItem {
  dealAmount: string;  // "34,700" (만원, 쉼표 포함)
  excluUseAr: string;  // "84.51" (전용면적 ㎡)
  floor: string;
  buildYear: string;
  aptNm: string;
  dealYear?: string;
  dealMonth?: string;
}

interface MolitResponse {
  response?: {
    body?: {
      items?: {
        item?: MolitItem | MolitItem[];
      };
      totalCount?: number;
    };
    header?: { resultCode?: string; resultMsg?: string };
  };
}

function parsePrice(str: string): number {
  return parseInt(str.replace(/,/g, '').trim(), 10) * 10000; // 만원 → 원
}

function parseArea(str: string): number {
  return parseFloat(str.trim());
}

function sqmToPyung(sqm: number): number {
  return sqm / 3.3058;
}

/** 법정동코드 앞 5자리 (시군구 코드) 기준으로 실거래가 조회 */
async function fetchMonthTransactions(
  serviceKey: string,
  lawdCd: string,  // 5자리
  dealYmd: string, // YYYYMM
): Promise<MolitItem[]> {
  const params = new URLSearchParams({
    serviceKey,
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    numOfRows: '1000',
    pageNo: '1',
  });

  const res = await fetch(`${MOLIT_BASE}?${params}`, { next: { revalidate: 86400 } });
  if (!res.ok) return [];

  const text = await res.text();

  // XML 응답 처리 (data.go.kr는 기본 XML)
  // item 태그 파싱
  const items: MolitItem[] = [];
  const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
      return m ? m[1].trim() : '';
    };
    items.push({
      dealAmount: get('dealAmount'),
      excluUseAr: get('excluUseAr'),
      floor: get('floor'),
      buildYear: get('buildYear'),
      aptNm: get('aptNm'),
      dealYear: get('dealYear'),
      dealMonth: get('dealMonth'),
    });
  }
  return items;
}

/** 최근 N개월의 YYYYMM 배열 생성 */
function recentMonths(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** OLS 단순 선형회귀 — slope b (y = a + b*x) */
function olsSlope(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const sumX  = x.reduce((a, b) => a + b, 0);
  const sumY  = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

/** 표본 표준편차 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function maxDrawdown(pricesByMonth: number[][]): number {
  // 월별 중위값 시계열에서 최대 낙폭 계산
  const monthlyMedians = pricesByMonth.map(m => median(m)).filter(v => v > 0);
  if (monthlyMedians.length < 2) return 0.15; // 데이터 부족 시 15% 기본

  let peak = 0;
  let mdd = 0;
  for (const v of monthlyMedians) {
    if (v > peak) peak = v;
    const drawdown = peak > 0 ? (peak - v) / peak : 0;
    if (drawdown > mdd) mdd = drawdown;
  }
  return mdd;
}

/**
 * 특정 법정동코드 기준 실거래가 분석
 * @param lawdCd 5자리 시군구 코드 (예: "11650" = 서초구)
 * @param desiredPyung 희망 전용면적 (평)
 * @param lookbackMonths 조회 기간 (기본 12개월 — 타임아웃 방지)
 * @param complexName 단지명 필터 — 있으면 해당 단지 거래만 사용
 * @param newAptOnly true이면 신축(5년 이내) 거래만 포함 — 인근 신축 시세 조회 시 사용
 */
export async function fetchLocalPrice(
  serviceKey: string,
  lawdCd: string,
  desiredPyung: number,
  lookbackMonths = 12,
  complexName?: string,
  newAptOnly = false,
): Promise<ApiResult<LocalPriceData>> {
  try {
    // 최대 60개월까지 허용 (Next.js revalidate 캐시로 재호출 비용 0)
    const months = recentMonths(Math.min(lookbackMonths, 60));
    const currentYear = new Date().getFullYear();
    const newAptCutoffYear = currentYear - 5;

    // 병렬 조회
    const batchResults = await Promise.all(
      months.map(ym => fetchMonthTransactions(serviceKey, lawdCd, ym))
    );

    const allTx: ApartmentTransaction[] = [];
    const pricesByMonth: number[][] = [];
    // 볼린저 밴드용: 필터 없이 전체 거래 월별 중위가 수집 (역순: 최근=index0)
    const allTxMonthlyPrices: number[][] = [];

    // 단지명 정규화 (괄호/특수문자 제거 후 비교)
    const normalizedComplex = complexName
      ? complexName.replace(/[()（）\[\]]/g, '').replace(/\s+/g, '').toLowerCase()
      : null;

    for (const items of batchResults) {
      const monthPrices: number[] = [];
      const allMonthRaw: number[] = [];  // 필터 없는 전체 거래 (trend용)
      for (const item of items) {
        const price = parsePrice(item.dealAmount);
        const areaSqm = parseArea(item.excluUseAr);
        if (!(price > 0) || !(areaSqm > 0)) continue; // NaN-safe: NaN <= 0 = false이므로 > 0 역조건 사용

        const pyung = sqmToPyung(areaSqm);
        const pricePerPyung = price / pyung;
        allMonthRaw.push(pricePerPyung);  // 필터 없이 수집

        // 단지명 필터 — 있으면 해당 단지만
        if (normalizedComplex && item.aptNm) {
          const itemName = item.aptNm.replace(/[()（）\[\]]/g, '').replace(/\s+/g, '').toLowerCase();
          if (!itemName.includes(normalizedComplex) && !normalizedComplex.includes(itemName)) continue;
        }

        const buildYear = parseInt(item.buildYear || '0', 10);

        // newAptOnly 모드: 신축(5년 이내)만 포함 — 구축 오염 방지
        if (newAptOnly && buildYear > 0 && buildYear < newAptCutoffYear) continue;

        const dealYm = (item.dealYear || '') + (item.dealMonth || '').padStart(2, '0');

        allTx.push({
          price,
          area: areaSqm,
          pricePerPyung,
          dealDate: dealYm,
          floor: parseInt(item.floor || '0', 10),
          buildYear,
          aptName: item.aptNm || '',
        });
        monthPrices.push(pricePerPyung);
      }
      pricesByMonth.push(monthPrices);
      allTxMonthlyPrices.push(allMonthRaw);
    }

    if (allTx.length === 0) {
      return { data: null, error: '해당 지역 실거래가 데이터 없음' };
    }

    // 최근 12개월 신축 (건축년도 기준)
    const recent12Months = new Set(recentMonths(12));
    const recentNewAptPrices = allTx
      .filter(tx => tx.buildYear >= newAptCutoffYear && recent12Months.has(tx.dealDate))
      .map(tx => tx.pricePerPyung);

    const medianNewAptPricePerPyung = recentNewAptPrices.length > 0
      ? median(recentNewAptPrices)
      : median(allTx.map(tx => tx.pricePerPyung)); // 신축 데이터 없으면 전체 중위값

    const peakPricePerPyung = Math.max(...allTx.map(tx => tx.pricePerPyung));
    const mddRate = maxDrawdown(pricesByMonth);

    // 희망 평형 기준 추정 현재 시세
    const estimatedCurrentPrice = medianNewAptPricePerPyung * desiredPyung;

    const basePeriod = months[0]; // 가장 최근 조회 년월

    // 볼린저 밴드용 OLS 추세 + σ 계산
    // allTxMonthlyPrices는 역순(최근=index0) → 시간순(과거=index0)으로 뒤집어서 OLS
    const chronoMedians = allTxMonthlyPrices
      .map(arr => median(arr))
      .reverse(); // 이제 [oldest, ..., most_recent]

    const validPoints = chronoMedians
      .map((y, x) => ({ x, y }))
      .filter(p => p.y > 0);

    const trendSlopePerMonth = validPoints.length >= 4
      ? olsSlope(validPoints.map(p => p.x), validPoints.map(p => p.y))
      : 0;

    const monthlyStdDev = validPoints.length >= 4
      ? stdDev(validPoints.map(p => p.y))
      : 0;

    return {
      data: {
        medianNewAptPricePerPyung,
        peakPricePerPyung,
        mddRate,
        estimatedCurrentPrice,
        lawdCd,
        basePeriod,
        fromApi: true,
        trendSlopePerMonth,
        monthlyStdDev,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

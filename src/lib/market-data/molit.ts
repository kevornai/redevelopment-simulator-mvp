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

const MOLIT_BASE = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

interface MolitItem {
  거래금액: string;   // "150,000" (만원, 쉼표 포함)
  전용면적: string;   // "84.51"
  층: string;
  건축년도: string;
  아파트: string;
  계약년도?: string;
  계약월?: string;
  년?: string;
  월?: string;
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
      거래금액: get('거래금액'),
      전용면적: get('전용면적'),
      층: get('층'),
      건축년도: get('건축년도'),
      아파트: get('아파트'),
      년: get('년'),
      월: get('월'),
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
 * @param lookbackMonths 조회 기간 (기본 24개월 — MDD 계산용)
 */
export async function fetchLocalPrice(
  serviceKey: string,
  lawdCd: string,
  desiredPyung: number,
  lookbackMonths = 24,
): Promise<ApiResult<LocalPriceData>> {
  try {
    const months = recentMonths(lookbackMonths);
    const currentYear = new Date().getFullYear();
    const newAptCutoffYear = currentYear - 5;

    // 병렬 조회 (최대 12개월씩 batch)
    const batchResults = await Promise.all(
      months.map(ym => fetchMonthTransactions(serviceKey, lawdCd, ym))
    );

    const allTx: ApartmentTransaction[] = [];
    const pricesByMonth: number[][] = [];

    for (const items of batchResults) {
      const monthPrices: number[] = [];
      for (const item of items) {
        const price = parsePrice(item.거래금액);
        const areaSqm = parseArea(item.전용면적);
        if (price <= 0 || areaSqm <= 0) continue;

        const pyung = sqmToPyung(areaSqm);
        const pricePerPyung = price / pyung;
        const buildYear = parseInt(item.건축년도 || '0', 10);
        const dealYm = (item.년 || '') + (item.월 || '').padStart(2, '0');

        allTx.push({
          price,
          area: areaSqm,
          pricePerPyung,
          dealDate: dealYm,
          floor: parseInt(item.층 || '0', 10),
          buildYear,
          aptName: item.아파트 || '',
        });
        monthPrices.push(pricePerPyung);
      }
      pricesByMonth.push(monthPrices);
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

    return {
      data: {
        medianNewAptPricePerPyung,
        peakPricePerPyung,
        mddRate,
        estimatedCurrentPrice,
        lawdCd,
        basePeriod,
        fromApi: true,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

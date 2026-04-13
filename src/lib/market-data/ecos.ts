/**
 * ECOS (한국은행 경제통계시스템) API 연동
 * - 한국은행 기준금리
 * - 예금은행 주택담보대출 가중평균금리
 * Docs: https://ecos.bok.or.kr/api/#/DevGuide
 */

import type { ApiResult, RateData } from './types';

const ECOS_BASE = 'https://ecos.bok.or.kr/api';

interface EcosItem {
  TIME: string;   // YYYYMM
  DATA_VALUE: string;
}

interface EcosResponse {
  StatisticSearch?: {
    row?: EcosItem[];
  };
}

async function fetchEcosSeries(
  apiKey: string,
  statCode: string,
  itemCode: string,
  months = 3,
): Promise<number | null> {
  const now = new Date();
  const endYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  // 여유분을 두고 6개월치 요청 (최신 확정치가 1~2개월 지연될 수 있음)
  const startDate = new Date(now.getFullYear(), now.getMonth() - months - 4, 1);
  const startYm = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}`;

  const url = `${ECOS_BASE}/StatisticSearch/${apiKey}/json/kr/1/20/${statCode}/M/${startYm}/${endYm}/${itemCode}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const json: EcosResponse = await res.json();
  const rows = json.StatisticSearch?.row;
  if (!rows || rows.length === 0) return null;

  // 가장 최근 값 (마지막 row)
  const latest = rows[rows.length - 1];
  const val = parseFloat(latest.DATA_VALUE);
  return isNaN(val) ? null : val;
}

/**
 * 금리 데이터 조회
 * - baserate: 한국은행 기준금리 (722Y001 / 0101000)
 * - mortgageRate: 예금은행 주담대 가중평균 신규금리 (721Y002 / BEAF)
 *
 * pfRate = baserate + 3.0pp (PF 스프레드 일반적 수준)
 * targetYield = 국고채 3년 추정 + 위험프리미엄 3pp
 *   → 국고채 ≈ baserate + 0.5pp (단순 추정)
 */
export async function fetchRates(apiKey: string): Promise<ApiResult<RateData>> {
  try {
    const [baserate, mortgageRate] = await Promise.all([
      fetchEcosSeries(apiKey, '722Y001', '0101000'),  // 기준금리
      fetchEcosSeries(apiKey, '721Y002', 'BEAF'),     // 주담대 신규 가중평균금리
    ]);

    if (baserate === null) {
      return { data: null, error: 'ECOS 기준금리 조회 실패' };
    }

    const now = new Date();
    const basePeriod = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const resolvedMortgageRate = mortgageRate ?? baserate + 1.2;
    const pfRate = baserate + 3.0;           // PF 스프레드 3pp
    const targetYield = baserate + 3.5;      // 기준금리 + 위험프리미엄

    return {
      data: {
        baserate,
        mortgageRate: resolvedMortgageRate,
        pfRate,
        targetYield,
        basePeriod,
        fromApi: true,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

/** API 실패 시 사용하는 fallback 값 (2025Q1 기준) */
export const RATE_FALLBACK: RateData = {
  baserate: 2.75,
  mortgageRate: 4.2,
  pfRate: 5.75,
  targetYield: 6.25,
  basePeriod: '202501',
  fromApi: false,
};

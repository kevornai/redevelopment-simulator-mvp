/**
 * KOSIS (통계청 국가통계포털) API 연동
 * - 건설공사비지수 (건설업조사, 표준코드 403_MT_DTITD01)
 * Docs: https://kosis.kr/openapi/
 *
 * 필요한 두 가지 지표:
 *   rRecent : 최근 36개월 월평균 공사비 인상률
 *   rLong   : 과거 120개월 월평균 공사비 인상률
 */

import type { ApiResult, ConstructionCostData } from './types';

const KOSIS_BASE = 'https://kosis.kr/openapi/Param/statisticsParameterData.do';

// 건설공사비지수: KOSIS 통계표 코드
// - orgId: 403 (통계청 건설업조사)
// - tblId: MT_DTITD01 (건설공사비지수)
// - 항목 AAAAAA: 건설공사비지수 전체 (주거용)
const KOSIS_STATS = {
  orgId: '403',
  tblId: 'MT_DTITD01',
  itmId: 'T10',       // 건설공사비지수 총지수
  objL1: 'ALL',
};

interface KosisItem {
  PRD_DE: string;   // YYYYMM
  DT: string;       // 지수값
}

interface KosisResponse {
  err?: string;
  // 직접 배열로 반환되는 경우도 있음
  [key: string]: unknown;
}

function ymToDate(ym: string): Date {
  return new Date(parseInt(ym.slice(0, 4)), parseInt(ym.slice(4, 6)) - 1, 1);
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** 지수 시계열 → 월평균 인상률 (CAGR 방식) */
function calcMonthlyRate(series: { ym: string; value: number }[], lookbackMonths: number): number {
  if (series.length < 2) return 0.003; // fallback

  const latest = series[series.length - 1];
  const cutoff = new Date(ymToDate(latest.ym));
  cutoff.setMonth(cutoff.getMonth() - lookbackMonths);

  // lookbackMonths 전에 가장 가까운 관측치
  let baseline = series[0];
  for (const s of series) {
    if (ymToDate(s.ym) >= cutoff) { baseline = s; break; }
  }

  const months = monthsBetween(ymToDate(baseline.ym), ymToDate(latest.ym));
  if (months <= 0 || baseline.value <= 0) return 0.003;

  return Math.pow(latest.value / baseline.value, 1 / months) - 1;
}

export async function fetchConstructionCost(apiKey: string): Promise<ApiResult<ConstructionCostData>> {
  try {
    const now = new Date();
    // 넉넉하게 130개월치 요청
    const startDate = new Date(now.getFullYear(), now.getMonth() - 132, 1);
    const startPrd = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endPrd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const params = new URLSearchParams({
      method: 'getList',
      apiKey,
      itmId: KOSIS_STATS.itmId,
      objL1: KOSIS_STATS.objL1,
      format: 'json',
      jsonVD: 'Y',
      userStatsId: `${KOSIS_STATS.orgId}/${KOSIS_STATS.tblId}/MT_DTITD01/A/2/2/`,
      statsId: `${KOSIS_STATS.orgId}_${KOSIS_STATS.tblId}`,
      prdSe: 'M',
      startPrdDe: startPrd,
      endPrdDe: endPrd,
    });

    const res = await fetch(`${KOSIS_BASE}?${params}`, { next: { revalidate: 86400 } });
    if (!res.ok) return { data: null, error: `KOSIS HTTP ${res.status}` };

    const json: KosisResponse | KosisItem[] = await res.json();

    // KOSIS는 배열 또는 { err } 형태
    let rows: KosisItem[] = [];
    if (Array.isArray(json)) {
      rows = json as KosisItem[];
    } else if ((json as KosisResponse).err) {
      return { data: null, error: `KOSIS 오류: ${(json as KosisResponse).err}` };
    }

    if (rows.length === 0) return { data: null, error: 'KOSIS 건설공사비지수 데이터 없음' };

    const series = rows
      .map(r => ({ ym: r.PRD_DE.replace('-', '').slice(0, 6), value: parseFloat(r.DT) }))
      .filter(s => !isNaN(s.value))
      .sort((a, b) => a.ym.localeCompare(b.ym));

    const currentIndex = series[series.length - 1].value;
    const rRecent = calcMonthlyRate(series, 36);
    const rLong = calcMonthlyRate(series, 120);

    const basePeriod = series[series.length - 1].ym;

    return {
      data: { rRecent, rLong, currentIndex, basePeriod, fromApi: true },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

/** fallback: 공사비 인상 추정치 (실API 실패 시) */
export const CONSTRUCTION_COST_FALLBACK: ConstructionCostData = {
  rRecent: 0.007,   // 최근 3년: 월 0.7%
  rLong: 0.002,     // 과거 10년: 월 0.2%
  currentIndex: 130.0,
  basePeriod: '202501',
  fromApi: false,
};

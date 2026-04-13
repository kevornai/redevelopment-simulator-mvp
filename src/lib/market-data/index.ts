/**
 * 시장 데이터 통합 집계 모듈
 * Server Action 또는 Route Handler에서 호출
 *
 * 각 API가 실패해도 fallback으로 대체하여
 * 계산 엔진이 항상 완전한 MarketData를 받도록 보장.
 */

import type { MarketData } from './types';
import { fetchRates, RATE_FALLBACK } from './ecos';
import { fetchConstructionCost, CONSTRUCTION_COST_FALLBACK } from './kosis';
import { fetchLocalPrice } from './molit';
import { estimateFromOfficialPrice } from './nsdi';

interface FetchMarketDataOptions {
  /** 법정동코드 (5자리 시군구) — null이면 localPrice 조회 생략 */
  lawdCd?: string | null;
  /** 희망 평형 (평) — localPrice 추정 현재 시세 계산에 사용 */
  desiredPyung?: number;
  /** 사용자가 직접 입력한 공시가격 (원) */
  officialPrice?: number | null;
}

/**
 * 전체 시장 데이터 조회
 * - ECOS: 금리
 * - KOSIS: 건설공사비지수
 * - MOLIT: 아파트 실거래가 (lawdCd 있을 때)
 * - 공시가격: 사용자 입력값 기반 (officialPrice)
 *
 * 모든 API 호출은 독립적으로 실행되며,
 * 실패한 항목은 fallback 값으로 대체.
 */
export async function fetchMarketData(opts: FetchMarketDataOptions = {}): Promise<MarketData> {
  const { lawdCd, desiredPyung = 84, officialPrice } = opts;

  const ecosKey = process.env.ECOS_API_KEY ?? '';
  const kosisKey = process.env.KOSIS_API_KEY ?? '';
  const molitKey = process.env.MOLIT_API_KEY ?? '';

  // 금리 + 공사비지수 병렬 조회
  const [ratesResult, costResult] = await Promise.all([
    ecosKey ? fetchRates(ecosKey) : Promise.resolve({ data: null, error: 'ECOS key 없음' }),
    kosisKey ? fetchConstructionCost(kosisKey) : Promise.resolve({ data: null, error: 'KOSIS key 없음' }),
  ]);

  const rates = ratesResult.data ?? RATE_FALLBACK;
  const constructionCost = costResult.data ?? CONSTRUCTION_COST_FALLBACK;

  // 오류 로깅 (서버 사이드)
  if (ratesResult.error) console.warn('[market-data] ECOS 실패:', ratesResult.error);
  if (costResult.error) console.warn('[market-data] KOSIS 실패:', costResult.error);

  // 실거래가 조회 (법정동코드 있을 때만)
  let localPrice = null;
  if (lawdCd && molitKey) {
    const localResult = await fetchLocalPrice(molitKey, lawdCd, desiredPyung);
    if (localResult.data) {
      localPrice = localResult.data;
    } else {
      console.warn('[market-data] MOLIT 실패:', localResult.error);
    }
  }

  // 공시가격: 사용자 입력 기반 (NSDI API는 단지/동/호 특정이 필요해서 별도 호출)
  const publicPrice = officialPrice && officialPrice > 0
    ? estimateFromOfficialPrice(officialPrice)
    : null;

  return {
    rates,
    constructionCost,
    localPrice,
    publicPrice,
    fetchedAt: new Date().toISOString(),
  };
}

export { fetchLocalPrice } from './molit';
export { fetchPublicPrice } from './nsdi';
export type { MarketData, RateData, ConstructionCostData, LocalPriceData, PublicPriceData } from './types';

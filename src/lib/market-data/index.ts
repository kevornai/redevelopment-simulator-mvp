/**
 * 시장 데이터 통합 집계 모듈
 *
 * KOSIS: Vercel(해외 IP) 차단 → Supabase market_cache 테이블에서 읽음
 *        캐시는 GitHub Actions 월간 cron이 업데이트
 * ECOS:  직접 호출 가능 (한국은행 API, 해외 허용)
 * MOLIT: 직접 호출 (https)
 */

import type { MarketData, ConstructionCostData, RateData } from './types';
import { fetchRates, RATE_FALLBACK } from './ecos';
import { CONSTRUCTION_COST_FALLBACK } from './kosis';
import { fetchLocalPrice } from './molit';
import { estimateFromOfficialPrice, fetchPublicPriceByName, fetchPublicPriceByBjdCode } from './nsdi';
import { createClient } from '@supabase/supabase-js';

interface FetchMarketDataOptions {
  lawdCd?: string | null;
  bjdCode?: string | null;       // 법정동코드 10자리 — NSDI 정밀 조회
  desiredPyung?: number;
  officialPrice?: number | null;
  /** 단지명 — 공시가격 미입력 시 NSDI 자동 조회에 사용 */
  complexName?: string | null;
}

/** Supabase market_cache에서 KOSIS 건설공사비 읽기 — DB에서 읽으면 fromApi:true */
async function fetchConstructionCostFromCache(): Promise<ConstructionCostData> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from('market_cache')
      .select('value, fetched_at')
      .eq('key', 'construction_cost')
      .single();
    // DB에서 읽은 값은 항상 활성 (수동입력이든 KOSIS든 캐시된 값)
    if (data?.value) return { ...data.value, fromApi: true };
  } catch { /* fallback */ }
  return CONSTRUCTION_COST_FALLBACK;
}

/** Supabase market_cache에서 ECOS 금리 읽기 (캐시 우선, 실패 시 직접 호출) */
async function fetchRatesWithCache(apiKey: string): Promise<RateData> {
  // 캐시 먼저 시도
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from('market_cache')
      .select('value, fetched_at')
      .eq('key', 'rates')
      .single();
    if (data?.value?.fromApi) {
      // 캐시가 30일 이내면 그대로 사용
      const age = Date.now() - new Date(data.fetched_at).getTime();
      if (age < 30 * 24 * 60 * 60 * 1000) return data.value as RateData;
    }
  } catch { /* direct API fallback */ }

  // 캐시 없거나 오래됐으면 직접 호출
  const result = await fetchRates(apiKey);
  return result.data ?? RATE_FALLBACK;
}

export async function fetchMarketData(opts: FetchMarketDataOptions = {}): Promise<MarketData> {
  const { lawdCd, bjdCode, desiredPyung = 84, officialPrice, complexName } = opts;

  const ecosKey = process.env.ECOS_API_KEY ?? '';
  const molitKey = process.env.MOLIT_API_KEY ?? '';
  const nsdiKey = process.env.NSDI_API_KEY ?? '';

  // 금리(ECOS) + 공사비(DB캐시) 병렬 조회
  const [rates, constructionCost] = await Promise.all([
    ecosKey ? fetchRatesWithCache(ecosKey) : Promise.resolve(RATE_FALLBACK),
    fetchConstructionCostFromCache(),
  ]);

  // 실거래가 (법정동코드 있을 때만)
  let localPrice = null;
  if (lawdCd && molitKey) {
    const result = await fetchLocalPrice(molitKey, lawdCd, desiredPyung, 12, complexName ?? undefined);
    if (result.data) localPrice = result.data;
    else console.warn('[market-data] MOLIT 실패:', result.error);
  }

  // 공시가격: 입력값 있으면 그대로, 없으면 NSDI 자동 조회
  // bjdCode(10자리) + 단지명 → 가장 정확
  // bjdCode 없으면 단지명만으로 검색 (괄호 안 이름 추출 포함)
  let publicPrice = null;
  if (officialPrice && officialPrice > 0) {
    publicPrice = estimateFromOfficialPrice(officialPrice);
  } else if (nsdiKey && complexName) {
    const result = bjdCode
      ? await fetchPublicPriceByBjdCode(nsdiKey, bjdCode, complexName)
      : await fetchPublicPriceByName(nsdiKey, complexName);
    if (result.data) publicPrice = result.data;
    else console.warn('[market-data] NSDI 자동조회 실패:', result.error);
  }

  return { rates, constructionCost, localPrice, publicPrice, fetchedAt: new Date().toISOString() };
}

export { fetchLocalPrice } from './molit';
export { fetchPublicPrice } from './nsdi';
export type { MarketData, RateData, ConstructionCostData, LocalPriceData, PublicPriceData } from './types';

/**
 * NSDI (국토정보플랫폼) 공동주택가격속성조회 WFS API
 * API Key: NSDI_API_KEY
 * Endpoint: https://api.vworld.kr/ned/wfs/getApartHousePrice
 *
 * 목적:
 *   - 공시가격 (officialPrice) 조회
 *   - 공시가격 현실화율 추정 → estimatedAppraisalRate 계산
 *
 * 참고: 공동주택가격속성조회는 WFS 방식으로 법정동코드(bjdCode) + 단지명으로 조회
 */

import type { ApiResult, PublicPriceData } from './types';

const NSDI_BASE = 'https://api.vworld.kr/ned/wfs/getApartHousePrice';

/** 국토부 발표 공시가격 현실화율 (연도별) — 정책 변경 시 수동 업데이트 */
const REALIZATION_RATE_BY_YEAR: Record<number, number> = {
  2025: 0.69,
  2024: 0.69,
  2023: 0.69,
  2022: 0.71,
  2021: 0.70,
};

function getRealizationRate(year = new Date().getFullYear()): number {
  return REALIZATION_RATE_BY_YEAR[year] ?? 0.69;
}

interface NsdiFeature {
  properties?: {
    pblntfPc?: string | number;   // 공시가격 (원)
    stdYear?: string | number;    // 기준년도
    dongNm?: string;
    hoNm?: string;
  };
}

interface NsdiResponse {
  features?: NsdiFeature[];
  totalFeatures?: number;
}

/**
 * 공동주택 공시가격 조회
 * @param apiKey NSDI API 키
 * @param bjdCode 법정동코드 (10자리, 예: "1165010200")
 * @param complexName 단지명 (예: "반포주공1단지")
 * @param dong 동 (예: "101")
 * @param ho 호 (예: "1001")
 */
export async function fetchPublicPrice(
  apiKey: string,
  bjdCode: string,
  complexName: string,
  dong?: string,
  ho?: string,
): Promise<ApiResult<PublicPriceData>> {
  try {
    const year = new Date().getFullYear();
    const realizationRate = getRealizationRate(year);

    const params = new URLSearchParams({
      key: apiKey,
      domain: 'revo-invest.com',
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'getApartHousePrice',
      output: 'application/json',
      maxFeatures: '10',
      cql_filter: [
        `bjdCode='${bjdCode}'`,
        complexName ? `kaptName='${complexName}'` : '',
        dong ? `dongNm='${dong}'` : '',
        ho ? `hoNm='${ho}'` : '',
        `stdYear='${year}'`,
      ].filter(Boolean).join(' AND '),
    });

    const res = await fetch(`${NSDI_BASE}?${params}`, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return { data: null, error: `NSDI HTTP ${res.status}` };
    }

    const json: NsdiResponse = await res.json();
    const features = json.features;

    if (!features || features.length === 0) {
      return { data: null, error: 'NSDI 공시가격 데이터 없음 (단지/동/호 확인 필요)' };
    }

    // 첫 번째 매칭 결과 사용
    const props = features[0].properties ?? {};
    const officialPrice = typeof props.pblntfPc === 'string'
      ? parseInt(props.pblntfPc.replace(/,/g, ''), 10)
      : Number(props.pblntfPc ?? 0);

    if (officialPrice <= 0) {
      return { data: null, error: 'NSDI 공시가격 파싱 실패' };
    }

    // 감정평가율 추정: 공시가 현실화율의 역수 기반
    // 공시가 ≈ 시세 × realizationRate
    // 감정평가액 ≈ 시세 × 0.90 ~ 1.05 (재개발: 0.9~1.1)
    // estimatedAppraisalRate = 감정평가액/공시가 = (시세 × 0.9) / (시세 × realizationRate)
    //                        = 0.9 / realizationRate
    const estimatedAppraisalRate = 0.9 / realizationRate;

    return {
      data: {
        officialPrice,
        realizationRate,
        estimatedAppraisalRate,
        fromApi: true,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

/**
 * 단지명으로 공시가격 자동 조회 — 저층/중층/고층 샘플 평균
 * 동/호 모를 때 사용. maxFeatures=100으로 조회 후 층별 샘플링.
 */
export async function fetchPublicPriceByName(
  apiKey: string,
  complexName: string,
): Promise<ApiResult<PublicPriceData>> {
  try {
    const year = new Date().getFullYear();
    const realizationRate = getRealizationRate(year);

    const params = new URLSearchParams({
      key: apiKey,
      domain: 'revo-invest.com',
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'getApartHousePrice',
      output: 'application/json',
      maxFeatures: '100',
      // 괄호 등 특수문자 제거 후 검색 (CQL 쿼리 안전성)
      cql_filter: `kaptName LIKE '%${complexName.replace(/[()（）]/g, '').trim()}%' AND stdYear='${year}'`,
    });

    const res = await fetch(`${NSDI_BASE}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { data: null, error: `NSDI HTTP ${res.status}` };

    const json: NsdiResponse = await res.json();
    const features = json.features ?? [];
    if (features.length === 0) {
      // 전년도로 재시도
      const prevParams = new URLSearchParams(params);
      prevParams.set('cql_filter', `kaptName LIKE '%${complexName.replace(/[()（）]/g, '').trim()}%' AND stdYear='${year - 1}'`);
      const prevRes = await fetch(`${NSDI_BASE}?${prevParams}`, { signal: AbortSignal.timeout(8000) });
      const prevJson: NsdiResponse = await prevRes.json();
      features.push(...(prevJson.features ?? []));
    }
    if (features.length === 0) return { data: null, error: `NSDI: "${complexName}" 공시가격 없음` };

    // 호수에서 층 번호 추출 → 저층/중층/고층 샘플링
    const withFloor = features
      .map(f => {
        const ho = f.properties?.hoNm ?? '';
        const price = typeof f.properties?.pblntfPc === 'string'
          ? parseInt((f.properties.pblntfPc as string).replace(/,/g, ''), 10)
          : Number(f.properties?.pblntfPc ?? 0);
        const floor = parseInt(ho.replace(/[^0-9]/g, '').slice(0, 2) || '0', 10);
        return { price, floor };
      })
      .filter(x => x.price > 0 && x.floor > 0)
      .sort((a, b) => a.floor - b.floor);

    if (withFloor.length === 0) {
      // 층 정보 없으면 그냥 평균
      const prices = features.map(f => {
        const p = f.properties?.pblntfPc;
        return typeof p === 'string' ? parseInt(p.replace(/,/g, ''), 10) : Number(p ?? 0);
      }).filter(p => p > 0);
      if (prices.length === 0) return { data: null, error: 'NSDI: 유효한 가격 없음' };
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      return { data: { officialPrice: Math.round(avg), realizationRate, estimatedAppraisalRate: 0.9 / realizationRate, fromApi: true }, error: null };
    }

    const maxFloor = withFloor[withFloor.length - 1].floor;
    const pick = (pct: number) => {
      const target = Math.round(maxFloor * pct);
      return withFloor.reduce((best, cur) =>
        Math.abs(cur.floor - target) < Math.abs(best.floor - target) ? cur : best
      );
    };
    const samples = [pick(0.15), pick(0.5), pick(0.85)];
    const avg = samples.reduce((s, x) => s + x.price, 0) / samples.length;

    return {
      data: { officialPrice: Math.round(avg), realizationRate, estimatedAppraisalRate: 0.9 / realizationRate, fromApi: true },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

/** fallback: 공시가격 직접 입력 시 현실화율만 적용 */
export function estimateFromOfficialPrice(
  officialPrice: number,
  year = new Date().getFullYear(),
): PublicPriceData {
  const realizationRate = getRealizationRate(year);
  return {
    officialPrice,
    realizationRate,
    estimatedAppraisalRate: 0.9 / realizationRate,
    fromApi: false,
  };
}

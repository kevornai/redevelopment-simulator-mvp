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
/** 단지명에서 NSDI 검색용 이름 변형 목록 생성
 * "권선 2구역(성일아파트)" → ["성일아파트", "권선 2구역성일아파트"]
 * "반포주공1단지" → ["반포주공1단지"]
 */
function buildSearchVariants(complexName: string): string[] {
  const variants: string[] = [];
  // 괄호 안 내용 추출: NSDI에는 구역명 없이 아파트 이름만 등록된 경우가 많음
  const parenMatch = complexName.match(/[（(]([^)）]+)[)）]/);
  if (parenMatch) variants.push(parenMatch[1].trim());
  // 전체 이름에서 괄호 제거
  const cleaned = complexName.replace(/[()（）]/g, '').replace(/\s+/g, ' ').trim();
  if (!variants.includes(cleaned)) variants.push(cleaned);
  return variants;
}

export async function fetchPublicPriceByName(
  apiKey: string,
  complexName: string,
): Promise<ApiResult<PublicPriceData>> {
  try {
    const year = new Date().getFullYear();
    const realizationRate = getRealizationRate(year);
    const searchVariants = buildSearchVariants(complexName);

    const makeParams = (name: string, yr: number) => new URLSearchParams({
      key: apiKey,
      domain: 'revo-invest.com',
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'getApartHousePrice',
      output: 'application/json',
      maxFeatures: '100',
      cql_filter: `kaptName LIKE '%${name}%' AND stdYear='${yr}'`,
    });

    const features: NsdiFeature[] = [];

    // 각 이름 변형에 대해 순차 시도 (결과 나오면 즉시 사용)
    outer: for (const variant of searchVariants) {
      for (const yr of [year, year - 1]) {
        const res = await fetch(`${NSDI_BASE}?${makeParams(variant, yr)}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const json: NsdiResponse = await res.json();
        const found = json.features ?? [];
        if (found.length > 0) {
          features.push(...found);
          break outer;
        }
      }
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

/**
 * bjdCode(법정동코드 10자리) + 단지명으로 공시가격 조회 — 가장 정확한 방법
 * 카카오 지오코딩으로 얻은 b_code 사용 시 동명이인 아파트 혼동 방지
 */
export async function fetchPublicPriceByBjdCode(
  apiKey: string,
  bjdCode: string,
  complexName: string,
): Promise<ApiResult<PublicPriceData>> {
  try {
    const year = new Date().getFullYear();
    const realizationRate = getRealizationRate(year);
    const searchVariants = buildSearchVariants(complexName);

    const makeParams = (name: string, yr: number) => new URLSearchParams({
      key: apiKey,
      domain: 'revo-invest.com',
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'getApartHousePrice',
      output: 'application/json',
      maxFeatures: '100',
      // bjdCode로 위치 고정 → 동명이인 아파트 혼동 없음
      cql_filter: `bjdCode='${bjdCode}' AND kaptName LIKE '%${name}%' AND stdYear='${yr}'`,
    });

    const features: NsdiFeature[] = [];

    outer: for (const variant of searchVariants) {
      for (const yr of [year, year - 1]) {
        const res = await fetch(`${NSDI_BASE}?${makeParams(variant, yr)}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const json: NsdiResponse = await res.json();
        const found = json.features ?? [];
        if (found.length > 0) {
          features.push(...found);
          break outer;
        }
      }
    }

    // bjdCode + 이름 모두 실패 시 bjdCode만으로 재시도 (단지명 등록 방식 차이)
    if (features.length === 0) {
      for (const yr of [year, year - 1]) {
        const params = new URLSearchParams({
          key: apiKey,
          domain: 'revo-invest.com',
          service: 'WFS',
          version: '2.0.0',
          request: 'GetFeature',
          typeName: 'getApartHousePrice',
          output: 'application/json',
          maxFeatures: '100',
          cql_filter: `bjdCode='${bjdCode}' AND stdYear='${yr}'`,
        });
        const res = await fetch(`${NSDI_BASE}?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const json: NsdiResponse = await res.json();
        const found = json.features ?? [];
        if (found.length > 0) {
          features.push(...found);
          break;
        }
      }
    }

    if (features.length === 0) {
      return { data: null, error: `NSDI: bjdCode=${bjdCode} "${complexName}" 공시가격 없음` };
    }

    // 저층/중층/고층 샘플링 (fetchPublicPriceByName과 동일 로직)
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
      const prices = features
        .map(f => {
          const p = f.properties?.pblntfPc;
          return typeof p === 'string' ? parseInt(p.replace(/,/g, ''), 10) : Number(p ?? 0);
        })
        .filter(p => p > 0);
      if (prices.length === 0) return { data: null, error: 'NSDI: 유효한 가격 없음' };
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      return {
        data: { officialPrice: Math.round(avg), realizationRate, estimatedAppraisalRate: 0.9 / realizationRate, fromApi: true },
        error: null,
      };
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

/**
 * PNU(필지고유번호)로 공시가격 조회 — 단지명 불필요, 지역 무관하게 동작
 * PNU = bjdCode(10) + 산여부(1, 보통 "0") + 본번(4) + 부번(4) = 19자리
 */
export async function fetchPublicPriceByPnu(
  apiKey: string,
  bjdCode: string,
  bun: string,
  ji: string,
): Promise<ApiResult<PublicPriceData>> {
  try {
    const pnuPrefix = `${bjdCode}0${bun.padStart(4, '0')}${(ji || '0').padStart(4, '0')}`;
    const year = new Date().getFullYear();
    const realizationRate = getRealizationRate(year);

    const features: NsdiFeature[] = [];
    for (const yr of [year, year - 1]) {
      const params = new URLSearchParams({
        key: apiKey,
        domain: 'revo-invest.com',
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: 'getApartHousePrice',
        output: 'application/json',
        maxFeatures: '100',
        cql_filter: `pnu LIKE '${pnuPrefix}%' AND stdYear='${yr}'`,
      });
      const res = await fetch(`${NSDI_BASE}?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const json: NsdiResponse = await res.json();
      const found = json.features ?? [];
      if (found.length > 0) { features.push(...found); break; }
    }

    if (features.length === 0) return { data: null, error: `NSDI: PNU=${pnuPrefix} 공시가격 없음` };

    const prices = features
      .map(f => {
        const p = f.properties?.pblntfPc;
        return typeof p === 'string' ? parseInt(p.replace(/,/g, ''), 10) : Number(p ?? 0);
      })
      .filter(p => p > 0);
    if (prices.length === 0) return { data: null, error: 'NSDI PNU: 유효 가격 없음' };
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
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

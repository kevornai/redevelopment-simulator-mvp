/**
 * 국토부 건축물대장 API (세움터 / data.go.kr)
 * Endpoint: getBrTitleInfo (건축물대장 표제부)
 *
 * 목적: 아파트 단지의 현재 연면적(totArea) 조회
 *   → 재건축 후 총 연면적 추정의 기초 데이터
 */

import type { ApiResult } from './types';

const BR_BASE = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo';

export interface BuildingFloorData {
  totalFloorArea: number;  // 연면적 합계 (㎡)
  buildingCount: number;   // 조회된 동 수
  fromApi: true;
}

/**
 * 건축물대장 총괄표제부에서 단지 전체 연면적 조회
 *
 * @param serviceKey data.go.kr 인증키 (MOLIT_API_KEY와 동일 포털)
 * @param sigunguCd  시군구코드 5자리 (예: "41113" = 수원시 권선구)
 * @param bjdongCd   법정동코드 5자리 (예: "13100")
 * @param bun        본번 4자리 (예: "0361")
 * @param ji         부번 4자리 (예: "0001")
 */
export async function fetchBuildingFloorArea(
  serviceKey: string,
  sigunguCd: string,
  bjdongCd: string,
  bun: string,
  ji: string,
): Promise<ApiResult<BuildingFloorData>> {
  if (!serviceKey || !sigunguCd || !bjdongCd || !bun) {
    return { data: null, error: '필수 파라미터 누락' };
  }

  try {
    const params = new URLSearchParams({
      serviceKey,
      sigunguCd,
      bjdongCd,
      bun: bun.padStart(4, '0'),
      ji: (ji || '0000').padStart(4, '0'),
      numOfRows: '10',
      pageNo: '1',
    });

    const res = await fetch(`${BR_BASE}?${params}`, {
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };

    const text = await res.text();

    // 에러 응답 감지
    if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR') ||
        text.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR')) {
      return { data: null, error: 'API 키 오류 또는 요청 한도 초과' };
    }

    // <totArea> 파싱 — 총괄표제부는 단지 1개 레코드
    const match = text.match(/<totArea>([^<]+)<\/totArea>/);
    if (!match) {
      return { data: null, error: '건축물대장 데이터 없음 (번지 불일치 가능성)' };
    }

    const totalFloorArea = parseFloat(match[1].trim()) || 0;
    if (totalFloorArea <= 0) {
      return { data: null, error: 'totArea 값 0' };
    }

    return {
      data: {
        totalFloorArea,
        buildingCount: 1,
        fromApi: true,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

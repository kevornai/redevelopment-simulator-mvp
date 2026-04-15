/**
 * 국토부 건축물대장 API (세움터 / data.go.kr)
 * Endpoint: getBrTitleInfo (건축물대장 표제부)
 *
 * 목적: 아파트 단지의 현재 연면적(totArea) 조회
 *   → 재건축 후 총 연면적 추정의 기초 데이터
 */

import type { ApiResult } from './types';

const BR_BASE = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

export interface BuildingFloorData {
  totalFloorArea: number;  // 연면적 합계 (㎡)
  buildingCount: number;   // 조회된 동 수
  fromApi: true;
}

/**
 * 건축물대장 표제부에서 단지 전체 연면적 조회
 *
 * @param serviceKey data.go.kr 인증키 (MOLIT_API_KEY와 동일 포털)
 * @param sigunguCd  시군구코드 5자리 (예: "41113" = 수원시 권선구)
 * @param bjdongCd   법정동코드 5자리 (bjd_code 뒤 5자리, 예: "13100")
 * @param bldNm      건물명 (예: "성일아파트")
 */
export async function fetchBuildingFloorArea(
  serviceKey: string,
  sigunguCd: string,
  bjdongCd: string,
  bldNm: string,
): Promise<ApiResult<BuildingFloorData>> {
  if (!serviceKey || !sigunguCd || !bjdongCd || !bldNm) {
    return { data: null, error: '필수 파라미터 누락' };
  }

  try {
    const params = new URLSearchParams({
      serviceKey,
      sigunguCd,
      bjdongCd,
      bldNm,
      numOfRows: '100',
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

    // <totArea> 파싱 — 동별 연면적 합산
    const matches = [...text.matchAll(/<totArea>([^<]+)<\/totArea>/g)];
    if (matches.length === 0) {
      return { data: null, error: '건축물대장 데이터 없음 (건물명 불일치 가능성)' };
    }

    const totalFloorArea = matches.reduce(
      (sum, m) => sum + (parseFloat(m[1].trim()) || 0),
      0,
    );

    if (totalFloorArea <= 0) {
      return { data: null, error: 'totArea 합산값 0' };
    }

    return {
      data: {
        totalFloorArea,
        buildingCount: matches.length,
        fromApi: true,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

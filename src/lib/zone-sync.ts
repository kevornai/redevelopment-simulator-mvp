/**
 * 구역 데이터 자동 동기화
 * 정비몽땅 스크래핑 + MOLIT 실거래가 → zones_data 테이블 갱신
 *
 * 갱신 대상:
 *   - project_stage        → 정비몽땅 스크래핑
 *   - construction_start_announced_ym → 정비몽땅 스크래핑
 *   - neighbor_new_apt_price / peak_local / mdd_local → MOLIT API (이미 계산 시 실시간 반영)
 *   - updated_at           → 매 동기화마다 갱신
 *
 * 갱신 불가 (공개 API/스크래핑 불가, 관리자 직접 입력 필요):
 *   - total_appraisal_value  (관리처분계획서 PDF)
 *   - general_sale_area      (관리처분계획서 PDF)
 *   - member_sale_area       (관리처분계획서 PDF)
 *   - member_sale_price_per_pyung (조합 결정 전까지 비공개)
 *   - land_official_price_per_sqm (개별공시지가 — 토지 단위 조회, 별도 세팅 필요)
 */

import { createClient } from "@/lib/supabase/server";
import { fetchCleansysData } from "@/lib/market-data/cleansys";
import { fetchLocalPrice } from "@/lib/market-data/molit";

// 동기화할 구역 목록 (active 재건축만)
const SYNC_ZONES = [
  { zoneId: "banpo",             lawdCd: "11650" },
  { zoneId: "gaepo",             lawdCd: "11680" },
  { zoneId: "gaepo4",            lawdCd: "11680" },
  { zoneId: "dunchon",           lawdCd: "11740" },
  { zoneId: "chamsil",           lawdCd: "11710" },
  { zoneId: "seocho",            lawdCd: "11650" },
  { zoneId: "nowon",             lawdCd: "11350" },
  { zoneId: "mokdong",           lawdCd: "11470" },
  { zoneId: "gwacheon",          lawdCd: "41390" },
  { zoneId: "gwacheon1",         lawdCd: "41390" },
  { zoneId: "gwacheon2",         lawdCd: "41390" },
  { zoneId: "bundang_sunae",     lawdCd: "41135" },
  { zoneId: "bundang_seohyeon",  lawdCd: "41135" },
  { zoneId: "pyeongchon",        lawdCd: "41171" },
  { zoneId: "ilsan",             lawdCd: "41285" },
];

export interface ZoneSyncResult {
  zoneId: string;
  success: boolean;
  updated: string[];   // 갱신된 컬럼 목록
  error?: string;
  cleansysFromScrape: boolean;
}

/** 단일 구역 동기화 */
export async function syncZone(
  zoneId: string,
  lawdCd: string,
  desiredPyung = 59
): Promise<ZoneSyncResult> {
  const result: ZoneSyncResult = {
    zoneId,
    success: false,
    updated: [],
    cleansysFromScrape: false,
  };

  try {
    const supabase = await createClient();

    // 1. 정비몽땅 스크래핑
    const cleansys = await fetchCleansysData(zoneId);
    result.cleansysFromScrape = cleansys.fromScrape;

    // 2. MOLIT 실거래가 (최근 12개월 ~ 최대 36개월)
    const molKey = process.env.MOLIT_API_KEY ?? "";
    const localPrice = molKey
      ? await fetchLocalPrice(molKey, lawdCd, desiredPyung)
      : null;

    // 3. 갱신할 컬럼 조합
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (cleansys.fromScrape) {
      if (cleansys.projectStage) {
        patch.project_stage = cleansys.projectStage;
        result.updated.push("project_stage");
      }
      if (cleansys.constructionStartYm) {
        patch.construction_start_announced_ym = cleansys.constructionStartYm;
        result.updated.push("construction_start_announced_ym");
      }
    }

    if (localPrice?.data) {
      const lp = localPrice.data;
      if (lp.fromApi) {
        if (lp.peakPricePerPyung > 0) {
          patch.peak_local = lp.peakPricePerPyung * desiredPyung;
          result.updated.push("peak_local");
        }
        if (lp.mddRate > 0) {
          patch.mdd_local = lp.mddRate;
          result.updated.push("mdd_local");
        }
        if (lp.estimatedCurrentPrice > 0) {
          patch.neighbor_new_apt_price = lp.estimatedCurrentPrice;
          result.updated.push("neighbor_new_apt_price");
        }
      }
    }

    if (Object.keys(patch).length <= 1) {
      // updated_at만 — 실질 업데이트 없음
      result.success = true;
      return result;
    }

    const { error } = await supabase
      .from("zones_data")
      .update(patch)
      .eq("zone_id", zoneId);

    if (error) throw error;

    result.success = true;
  } catch (e) {
    result.error = String(e);
  }

  return result;
}

/** 전체 구역 동기화 (순차 실행 — rate limit 방지) */
export async function syncAllZones(): Promise<ZoneSyncResult[]> {
  const results: ZoneSyncResult[] = [];

  for (const zone of SYNC_ZONES) {
    const r = await syncZone(zone.zoneId, zone.lawdCd);
    results.push(r);
    // 요청 간격 500ms (정비몽땅 rate limit 배려)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

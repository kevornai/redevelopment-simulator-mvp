"use server";

import { createClient } from "@supabase/supabase-js";
import { fetchBuildingFloorArea } from "@/lib/market-data/building-registry";
import type { Step1Data } from "./types";

// ─── 공사비 급지 추정 ─────────────────────────────────────────────────────────

const KOSIS_BASE_INDEX_2024 = 128.0;

type ConstructionTier =
  | "tier1_하이엔드"
  | "tier2_서울일반"
  | "tier3_수도권"
  | "tier4_지방";

const TIER_BASE: Record<ConstructionTier, number> = {
  tier1_하이엔드: 10_000_000,
  tier2_서울일반:  8_500_000,
  tier3_수도권:    7_500_000,
  tier4_지방:      7_000_000,
};

function estimateConstructionCost(
  bjdCode: string | null,
  kosisIndex: number,
): { costPerPyung: number; tier: ConstructionTier } {
  let tier: ConstructionTier = "tier4_지방";

  if (bjdCode) {
    const p5 = bjdCode.slice(0, 5);
    const TIER1 = ["11650", "11680", "11710", "11200"]; // 강남·서초·송파·용산
    const TIER2_EXTRA = ["41290", "41135", "41450", "41210"]; // 과천·성남분당·하남·광명

    if (TIER1.includes(p5)) {
      tier = "tier1_하이엔드";
    } else if (bjdCode.startsWith("11") || TIER2_EXTRA.includes(p5)) {
      tier = "tier2_서울일반";
    } else if (
      bjdCode.startsWith("41") ||
      bjdCode.startsWith("28") ||
      bjdCode.startsWith("26") ||
      bjdCode.startsWith("27") ||
      bjdCode.startsWith("29") ||
      bjdCode.startsWith("30") ||
      bjdCode.startsWith("31")
    ) {
      tier = "tier3_수도권";
    }
  }

  const ratio = kosisIndex > 0 ? kosisIndex / KOSIS_BASE_INDEX_2024 : 1;
  const costPerPyung = Math.round((TIER_BASE[tier] * ratio) / 10_000) * 10_000;
  return { costPerPyung, tier };
}

// ─── Kakao 역지오코딩 ─────────────────────────────────────────────────────────

async function reverseGeocode(
  lat: number,
  lng: number,
  kakaoKey: string,
): Promise<{ sigunguCd: string; bjdongCd: string; bun: string; ji: string } | null> {
  try {
    const headers = { Authorization: `KakaoAK ${kakaoKey}` };
    const [regionRes, addrRes] = await Promise.all([
      fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}&input_coord=WGS84`,
        { headers, signal: AbortSignal.timeout(5000) },
      ),
      fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}&input_coord=WGS84`,
        { headers, signal: AbortSignal.timeout(5000) },
      ),
    ]);
    const regionJson = await regionRes.json();
    const addrJson   = await addrRes.json();
    const region = regionJson.documents?.find(
      (d: { region_type: string }) => d.region_type === "B",
    );
    const addr = addrJson.documents?.[0]?.address;
    if (!region?.code || !addr?.main_address_no) return null;
    return {
      sigunguCd: region.code.slice(0, 5),
      bjdongCd:  region.code.slice(5, 10),
      bun:       addr.main_address_no,
      ji:        addr.sub_address_no ?? "0",
    };
  } catch {
    return null;
  }
}

// ─── 경과 개월 계산 ───────────────────────────────────────────────────────────

function elapsedMonths(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  return (
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  );
}

// ─── 메인 서버 액션 ───────────────────────────────────────────────────────────

export async function fetchStep1Data(
  zoneId: string,
): Promise<{ data: Step1Data | null; error: string | null }> {
  if (!zoneId) return { data: null, error: "구역 ID 없음" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // ── 구역 DB 조회 ─────────────────────────────────────────────────────────
  const { data: z, error: dbErr } = await supabase
    .from("gyeonggi_zones")
    .select("*")
    .eq("zone_id", zoneId)
    .single();

  if (dbErr || !z) return { data: null, error: dbErr?.message ?? "구역 없음" };

  const parseNum = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isNaN(n) ? null : n;
  };

  // ── 현재 단계 + 시작일 ────────────────────────────────────────────────────
  let projectStage  = "zone_designation";
  let stageStartDate: string | null = null;

  if (z.strcontr_date) {
    projectStage   = "construction_start";
    stageStartDate = z.strcontr_date;
  } else if (z.manage_disposit_confmtn_date) {
    projectStage   = "management_disposal";
    stageStartDate = z.manage_disposit_confmtn_date;
  } else if (z.biz_implmtn_confmtn_date) {
    projectStage   = "project_implementation";
    stageStartDate = z.biz_implmtn_confmtn_date;
  } else if (z.assoctn_found_confmtn_date) {
    projectStage   = "association_established";
    stageStartDate = z.assoctn_found_confmtn_date;
  } else if (z.zone_appont_first_date) {
    projectStage   = "zone_designation";
    stageStartDate = z.zone_appont_first_date;
  }

  // ── KOSIS 지수 (market_cache) ─────────────────────────────────────────────
  let kosisIndex: number = KOSIS_BASE_INDEX_2024;
  try {
    const { data: cache } = await supabase
      .from("market_cache")
      .select("value")
      .eq("key", "construction_cost")
      .single();
    if (cache && cache.value?.currentIndex > 0) kosisIndex = cache.value.currentIndex;
  } catch { /* fallback to base index */ }

  // ── bjd_code + 급지 추정 ──────────────────────────────────────────────────
  const bjdCode = z.bjd_code ?? null;
  const lawdCd  = z.lawd_cd ?? z.sigun_cd ?? null;
  const { costPerPyung, tier } = estimateConstructionCost(bjdCode, kosisIndex);

  // ── 건축물대장 조회 (Kakao 역지오코딩 선행) ───────────────────────────────
  const lat = parseNum(z.lat);
  const lng = parseNum(z.lng);
  const kakaoKey  = process.env.KAKAO_REST_API_KEY  ?? "";
  const molitKey  = process.env.MOLIT_API_KEY       ?? "";

  let buildingFloorArea: number | null = null;

  if (kakaoKey && molitKey && lat && lng) {
    const geo = await reverseGeocode(lat, lng, kakaoKey);
    if (geo) {
      const bfResult = await fetchBuildingFloorArea(
        molitKey,
        geo.sigunguCd,
        geo.bjdongCd,
        geo.bun,
        geo.ji,
      );
      if (bfResult.data) buildingFloorArea = bfResult.data.totalFloorArea;
    }
  }

  // ── 결과 조립 ─────────────────────────────────────────────────────────────
  const data: Step1Data = {
    lawdCd,
    bjdCode,

    existingUnits: {
      u40:     z.existing_hshld_u40    ?? null,
      c40_60:  z.existing_hshld_40_60  ?? null,
      c60_85:  z.existing_hshld_60_85  ?? null,
      c85_135: z.existing_hshld_85_135 ?? null,
      o135:    z.existing_hshld_o135   ?? null,
    },
    newUnits: {
      u40:     z.new_lotout_u40    ?? null,
      c40_60:  z.new_lotout_40_60  ?? null,
      c60_85:  z.new_lotout_60_85  ?? null,
      c85_135: z.new_lotout_85_135 ?? null,
      o135:    z.new_lotout_o135   ?? null,
    },

    farExisting: parseNum(z.existing_far),
    farNew:      parseNum(z.new_far),

    zoneSqm:           parseNum(z.zone_ar),
    buildingFloorArea,

    projectStage,
    stageStartDate,
    stageElapsedMonths: elapsedMonths(stageStartDate),

    constructionCostPerPyung: costPerPyung,
    constructionTier:         tier,
    kosisIndex,
  };

  return { data, error: null };
}

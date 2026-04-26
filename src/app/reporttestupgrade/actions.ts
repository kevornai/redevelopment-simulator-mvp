"use server";

import { createClient } from "@supabase/supabase-js";
import { fetchBuildingFloorArea } from "@/lib/market-data/building-registry";
import { fetchPublicPriceByBjdCode, fetchPublicPriceByName } from "@/lib/market-data/nsdi";
import { fetchLocalPrice } from "@/lib/market-data/molit";
import { getMemberSaleDiscountRate } from "@/lib/derive-zone-params";
import type { Step1Data, Step2Data } from "./types";

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

// ─── 날짜 정규화 (YYYYMMDD → YYYY-MM-DD, 이미 포맷된 건 그대로) ──────────────
function normalizeDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  return v;
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

  // ── 단계별 날짜 ───────────────────────────────────────────────────────────
  const dateZoneDesignation = normalizeDate(z.zone_appont_first_date);
  const datePromoCommittee  = normalizeDate(z.proplsn_commisn_aprv_date);
  const dateAssociation     = normalizeDate(z.assoctn_found_confmtn_date);
  const dateProjectImpl     = normalizeDate(z.biz_implmtn_confmtn_date);
  const dateMgmtDisposal    = normalizeDate(z.manage_disposit_confmtn_date);
  const dateConstruction    = normalizeDate(z.strcontr_date);
  const dateGeneralSale     = normalizeDate(z.genrl_lotout_date);
  const dateCompletion      = normalizeDate(z.compltn_date);

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
  let platArea:          number | null = null;

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
      if (bfResult.data) {
        buildingFloorArea = bfResult.data.totalFloorArea;
        platArea          = bfResult.data.platArea ?? null;
      }
    }
  }

  // ── 대지지분 계산 ─────────────────────────────────────────────────────────
  // 세대 대지지분 = platArea × (unitSqm / (totalUnits × unitSqm)) = platArea / totalUnits
  const UNIT_SQM = 59; // 60~85㎡ 구간 대표 전용면적
  const totalExistingUnits =
    (z.existing_hshld_u40    ?? 0) +
    (z.existing_hshld_40_60  ?? 0) +
    (z.existing_hshld_60_85  ?? 0) +
    (z.existing_hshld_85_135 ?? 0) +
    (z.existing_hshld_o135   ?? 0) ||
    (z.existing_hshld_cnt ?? 0);

  let landShareSqm: number | null = null;
  if (platArea && totalExistingUnits > 0) {
    landShareSqm = Math.round((platArea / totalExistingUnits) * 100) / 100;
  }

  // ── 공시가격 조회 (브이월드 NSDI) ─────────────────────────────────────────
  const nsdiKey   = process.env.NSDI_API_KEY ?? "";
  const zoneName  = z.imprv_zone_nm ?? "";
  let officialPrice:         number | null = null;
  let officialPriceApiError: string | null = null;

  if (nsdiKey) {
    let priceResult = bjdCode
      ? await fetchPublicPriceByBjdCode(nsdiKey, bjdCode, zoneName)
      : { data: null, error: "bjd_code 없음" };
    if (!priceResult.data) {
      priceResult = await fetchPublicPriceByName(nsdiKey, zoneName);
    }
    if (priceResult.data) {
      officialPrice = priceResult.data.officialPrice;
    } else {
      officialPriceApiError = priceResult.error ?? "조회 실패";
    }
  } else {
    officialPriceApiError = "NSDI_API_KEY 없음";
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

    dateZoneDesignation,
    datePromoCommittee,
    dateAssociation,
    dateProjectImpl,
    dateMgmtDisposal,
    dateConstruction,
    dateGeneralSale,
    dateCompletion,

    officialPrice,
    officialPriceApiError,

    landShareSqm,
    landSharePlatArea:   platArea,
    landShareTotalUnits: totalExistingUnits > 0 ? totalExistingUnits : null,
    landShareUnitSqm:    UNIT_SQM,

    memberSalePricePerPyung: null,

    constructionCostPerPyung: costPerPyung,
    constructionTier:         tier,
    kosisIndex,
  };

  return { data, error: null };
}

// ─── 2단계: 사업성 분석 (중립 시나리오) ──────────────────────────────────────

const SUPPLY_SQM = { u40: 53, c40_60: 80, c60_85: 102.5, c85_135: 147.5, o135: 196 } as const;

export async function fetchStep2Data(
  zoneId: string,
  step1: Step1Data,
  desiredPyung: number,
): Promise<{ data: Step2Data | null; error: string | null }> {
  if (!zoneId) return { data: null, error: "구역 ID 없음" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // ── 추가 DB 조회 (sigungu, 조합원분양가 확정 여부) ──────────────────────────
  const { data: z } = await supabase
    .from("gyeonggi_zones")
    .select("sigun_nm, member_sale_price_source, member_sale_price_per_pyung")
    .eq("zone_id", zoneId)
    .single();

  const sigungu              = (z as Record<string,unknown>)?.sigun_nm as string | null ?? null;
  const memberSalePriceSource = (z as Record<string,unknown>)?.member_sale_price_source as string ?? "cost_estimated";
  const memberSaleAnnounced  = Number((z as Record<string,unknown>)?.member_sale_price_per_pyung ?? 0);

  // ── ① 종전자산평가액 ─────────────────────────────────────────────────────────
  const eu = step1.existingUnits;
  const appraisalUnits =
    (eu.u40 ?? 0) + (eu.c40_60 ?? 0) + (eu.c60_85 ?? 0) + (eu.c85_135 ?? 0) + (eu.o135 ?? 0);
  const appraisalOfficialPrice = step1.officialPrice ?? 0;
  const totalAppraisalValue =
    appraisalUnits > 0 && appraisalOfficialPrice > 0
      ? Math.round(appraisalUnits * appraisalOfficialPrice * 1.4)
      : null;

  // ── ② p_base — MOLIT API ─────────────────────────────────────────────────────
  const molitKey = process.env.MOLIT_API_KEY ?? "";
  const lawdCd   = step1.lawdCd;
  let pBase:         number | null = null;
  let pBaseApiError: string | null = null;

  if (molitKey && lawdCd) {
    const r = await fetchLocalPrice(molitKey, lawdCd, desiredPyung, 24, undefined, true);
    if (r.data) pBase = r.data.medianNewAptPricePerPyung;
    else        pBaseApiError = r.error ?? "MOLIT 조회 실패";
  } else {
    pBaseApiError = molitKey ? "lawdCd 없음" : "MOLIT_API_KEY 없음";
  }

  // ── 신축연면적 계산 ──────────────────────────────────────────────────────────
  // 역산 대지면적 우선순위: platArea > buildingFloorArea÷기존용적률 > zone_area_sqm
  const farExistingUsed      = step1.farExisting;
  const farNewUsed           = step1.farNew;
  const buildingFloorAreaUsed = step1.buildingFloorArea;
  const platAreaUsed         = step1.landSharePlatArea; // 건축물대장 platArea

  let derivedSiteArea: number | null = null;
  if (platAreaUsed && platAreaUsed > 0) {
    derivedSiteArea = platAreaUsed;
  } else if (buildingFloorAreaUsed && farExistingUsed && farExistingUsed > 0) {
    derivedSiteArea = buildingFloorAreaUsed / (farExistingUsed / 100);
  } else if (step1.zoneSqm && step1.zoneSqm > 0) {
    derivedSiteArea = step1.zoneSqm;
  }

  const newFloorAreaSqm   = derivedSiteArea && farNewUsed && farNewUsed > 0
    ? Math.round(derivedSiteArea * (farNewUsed / 100))
    : null;
  const newFloorAreaPyung = newFloorAreaSqm ? Math.round(newFloorAreaSqm / 3.3058 * 10) / 10 : null;

  // ── 분양면적 (평형별 세대수 기반) ──────────────────────────────────────────
  const nu = step1.newUnits;

  const memberSaleAreaSqm =
    (eu.u40 ?? 0)    * SUPPLY_SQM.u40    +
    (eu.c40_60 ?? 0) * SUPPLY_SQM.c40_60 +
    (eu.c60_85 ?? 0) * SUPPLY_SQM.c60_85 +
    (eu.c85_135 ?? 0)* SUPPLY_SQM.c85_135 +
    (eu.o135 ?? 0)   * SUPPLY_SQM.o135   || null;

  const generalSaleAreaSqm = (
    Math.max(0, (nu.u40 ?? 0)    - (eu.u40 ?? 0))    * SUPPLY_SQM.u40    +
    Math.max(0, (nu.c40_60 ?? 0) - (eu.c40_60 ?? 0)) * SUPPLY_SQM.c40_60 +
    Math.max(0, (nu.c60_85 ?? 0) - (eu.c60_85 ?? 0)) * SUPPLY_SQM.c60_85 +
    Math.max(0, (nu.c85_135 ?? 0)- (eu.c85_135 ?? 0))* SUPPLY_SQM.c85_135+
    Math.max(0, (nu.o135 ?? 0)   - (eu.o135 ?? 0))   * SUPPLY_SQM.o135
  ) || null;

  const memberSaleAreaPyung  = memberSaleAreaSqm  ? Math.round(memberSaleAreaSqm  / 3.3058 * 10) / 10 : null;
  const generalSaleAreaPyung = generalSaleAreaSqm ? Math.round(generalSaleAreaSqm / 3.3058 * 10) / 10 : null;

  // ── ③ 조합원분양가 (중립) ────────────────────────────────────────────────────
  let memberSalePricePerPyung: number | null = null;
  let memberSaleDiscountRate:  number | null = null;

  if (memberSalePriceSource !== "cost_estimated" && memberSaleAnnounced > 0) {
    memberSalePricePerPyung = memberSaleAnnounced;
  } else if (step1.memberSalePricePerPyung && step1.memberSalePricePerPyung > 0) {
    // 1단계에서 수동 입력한 값
    memberSalePricePerPyung = step1.memberSalePricePerPyung;
  } else if (pBase && pBase > 0) {
    memberSaleDiscountRate  = getMemberSaleDiscountRate(sigungu, "neutral");
    memberSalePricePerPyung = Math.round(pBase * memberSaleDiscountRate);
  }

  // ── ② 일반분양수익 ───────────────────────────────────────────────────────────
  const generalRevenue = pBase && generalSaleAreaPyung
    ? Math.round(pBase * generalSaleAreaPyung)
    : null;

  // ── ③ 조합원분양수익 ─────────────────────────────────────────────────────────
  const memberRevenue = memberSalePricePerPyung && memberSaleAreaPyung
    ? Math.round(memberSalePricePerPyung * memberSaleAreaPyung)
    : null;

  const totalRevenue = generalRevenue != null && memberRevenue != null
    ? generalRevenue + memberRevenue
    : null;

  // ── ④ 총사업비 ──────────────────────────────────────────────────────────────
  const C0           = step1.constructionCostPerPyung;
  const otherCostRate = 0.30;
  const pfLoanRatio  = 0.50;
  const pfAnnualRate = 0.065;
  const projectMonths = 60;

  const pureCost     = C0 && newFloorAreaPyung ? Math.round(C0 * newFloorAreaPyung) : null;
  const otherCost    = pureCost ? Math.round(pureCost * otherCostRate) : null;
  const financialCost = pureCost
    ? Math.round(pureCost * pfLoanRatio * (pfAnnualRate / 12) * projectMonths)
    : null;
  const totalCost    = pureCost != null && otherCost != null && financialCost != null
    ? pureCost + otherCost + financialCost
    : null;

  // ── ⑤ 비례율 ────────────────────────────────────────────────────────────────
  const proportionalRate =
    totalRevenue != null && totalCost != null && totalAppraisalValue && totalAppraisalValue > 0
      ? Math.round(((totalRevenue - totalCost) / totalAppraisalValue) * 10000) / 100
      : null;

  // ── ⑥ 분담금 ────────────────────────────────────────────────────────────────
  const personalAppraisalValue = appraisalOfficialPrice > 0
    ? Math.round(appraisalOfficialPrice * 1.4)
    : null;
  const rightsValue = personalAppraisalValue && proportionalRate != null
    ? Math.round(personalAppraisalValue * (proportionalRate / 100))
    : null;
  const memberSaleTotalForUnit = memberSalePricePerPyung && desiredPyung > 0
    ? Math.round(memberSalePricePerPyung * desiredPyung)
    : null;
  const contribution = memberSaleTotalForUnit != null && rightsValue != null
    ? memberSaleTotalForUnit - rightsValue
    : null;

  const data: Step2Data = {
    appraisalUnits,
    appraisalOfficialPrice,
    totalAppraisalValue,
    pBase,
    pBaseApiError,
    buildingFloorAreaUsed,
    farExistingUsed,
    platAreaUsed,
    derivedSiteArea,
    farNewUsed,
    newFloorAreaSqm,
    newFloorAreaPyung,
    generalSaleAreaSqm,
    generalSaleAreaPyung,
    memberSaleAreaSqm,
    memberSaleAreaPyung,
    generalRevenue,
    memberSalePricePerPyung,
    memberSaleDiscountRate,
    memberRevenue,
    totalRevenue,
    constructionCostPerPyung: C0,
    pureCost,
    otherCostRate,
    otherCost,
    pfLoanRatio,
    pfAnnualRate,
    projectMonths,
    financialCost,
    totalCost,
    proportionalRate,
    desiredPyung,
    personalAppraisalValue,
    rightsValue,
    memberSaleTotalForUnit,
    contribution,
  };

  return { data, error: null };
}

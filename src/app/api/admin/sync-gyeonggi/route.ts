import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 경기도 API 원본 필드 타입
type GRow = Record<string, string | null>;

function nd(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  return v;
}
function ni(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
function makeZoneId(sigunNm: string, zoneName: string): string {
  const city = sigunNm.split(/\s/)[0];
  const name = zoneName.replace(/\s+/g, "").replace(/\([^)]*\)/g, "").replace(/(아파트|주공아파트|주공|단지)$/, "");
  return `${city}_${name}`;
}

export async function POST(req: NextRequest) {
  try {
    const rows: GRow[] = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ saved: 0, error: "rows가 비어있습니다." });
    }

    const supabase = await createClient();

    // source_id 중복 제거
    const deduped = Array.from(
      new Map(
        rows
          .filter(r => r.BIZ_TYPE_NM === "재건축" || r.BIZ_TYPE_NM === "재개발")
          .map(r => {
            const sourceId = `${r.SIGUN_CD}_${(r.IMPRV_ZONE_NM ?? "").replace(/\s+/g, "_")}`;
            return [sourceId, r] as [string, GRow];
          })
      ).values()
    );

    const records = deduped.map(r => ({
      zone_id:     makeZoneId(r.SIGUN_NM ?? "", r.IMPRV_ZONE_NM ?? ""),
      source_id:   `${r.SIGUN_CD}_${(r.IMPRV_ZONE_NM ?? "").replace(/\s+/g, "_")}`,
      sigun_nm:    r.SIGUN_NM,
      sigun_cd:    r.SIGUN_CD,
      biz_type_nm: r.BIZ_TYPE_NM,
      biz_step_nm: r.BIZ_STEP_NM,
      imprv_zone_nm: r.IMPRV_ZONE_NM,
      locplc_addr:   r.LOCPLC_ADDR,
      zone_ar:       r.ZONE_AR ? parseFloat(r.ZONE_AR) : null,
      // 기존주택
      existing_compltn_year:  r.STNG_HOUSNG_COMPLTN_PERD,
      existing_building_cnt:  ni(r.KISTNG_HOUSNG_COPPER_CNT),
      existing_hshld_cnt:     ni(r.XISTNG_HOUSNG_HSHLD_CNT),
      existing_hshld_u40:     ni(r.KISTNG_HSHLD_CNT_40_DESC),
      existing_hshld_40_60:   ni(r.STNG_HSHLD_CNT_40_60_DESC),
      existing_hshld_60_85:   ni(r.STNG_HSHLD_CNT_60_85_DESC),
      existing_hshld_85_135:  ni(r.STNG_HSHLD_CNT_85_135_DESC),
      existing_hshld_o135:    ni(r.ISTNG_HSHLD_CNT_135_DESC),
      // 사업시행 세대수
      implmtn_hshld_total:      ni(r.I_IMPLMTN_HSHLD_CNT_TOTAL),
      member_lotout_hshld_cnt:  ni(r.SOCNTMB_LOTOUT_HSHLD_CNT),
      general_lotout_hshld_cnt: ni(r.GENRL_LOTOUT_HSHLD_CNT),
      rent_hshld_cnt:           ni(r.RENT_HSHLD_CNT),
      // 신축 분양
      new_lotout_total:   ni(r.NCONST_LOTOUT_HOUSNG_CNT),
      new_lotout_u40:     ni(r.NST_HUSNG_LTUTAR40MUD_DESC),
      new_lotout_40_60:   ni(r.NST_HUSNG_LTUTAR4060M_DESC),
      new_lotout_60_85:   ni(r.NST_HUSNG_LTUTAR6085M_DESC),
      new_lotout_85_135:  ni(r.ST_HUSNG_LTUTAR85135M_DESC),
      new_lotout_o135:    ni(r.ST_HUSNGLTUTAR135MABV_DESC),
      // 신축 임대
      new_rent_total:  ni(r.NWCONST_RENT_HOUSING_CNT),
      new_rent_u40:    ni(r.RNST_HUSNGRENTAR40MUD_DESC),
      new_rent_40_60:  ni(r.RNST_HUSNGRENTAR4060M_DESC),
      new_rent_60_85:  ni(r.NST_HUSNGRENTAR_AR6085M_DESC),
      // 용적률
      existing_far: r.EXISTING_VOLUMRT_DESC,
      new_far:      r.NWCONST_VOLUMRT_DESC,
      // 조합 정보
      land_owner_cnt:  ni(r.LAND_OWNER_CNT),
      member_cnt:      ni(r.ASOCNTMB_CNT),
      biz_implmntr_nm: r.BIZ_IMPLMNTR_NM,
      biz_begin_date:  r.BIZ_PREARNGE_BEGIN_PERD,
      biz_end_date:    r.BIZ_PREARNGE_PERD,
      // 날짜
      rv_prearnge_zone_notif_date:  nd(r.RV_PREARNGE_ZONE_NOTIFC_DE),
      rv_zone_appont_date:          nd(r.RV_ZONE_APPONT_PREARNGE_DE),
      imprv_plan_foundng_date:      nd(r.IMPRV_PLAN_FOUNDNG_DE),
      zone_appont_first_date:       nd(r.IMPRV_ZONE_APPONT_FIRST_DE ?? r.PRV_ZONE_APPONT_FIRST_DE),
      zone_appont_change_date:      nd(r.PRV_ZONE_APPONT_CHANGE_DE),
      proplsn_commisn_aprv_date:    nd(r.PROPLSN_COMMISN_APRV_DE),
      prepar_evaltn_date:           nd(r.PREPAR_EVALTN_DE),
      safe_diagns_date:             nd(r.SAFE_DIAGNS_DE),
      assoctn_found_confmtn_date:   nd(r.ASSOCTN_FOUND_CONFMTN_DE ?? r.SSOCTN_FOUND_CONFMTN_DE),
      biz_implmtn_confmtn_date:     nd(r.BIZ_IMPLMTN_CONFMTN_DE),
      manage_disposit_confmtn_date: nd(r.MANAGE_DISPOSIT_CONFMTN_DE ?? r.NAGE_DISPOSIT_CONFMTN_DE),
      strcontr_date:                nd(r.STRCONTR_DE),
      genrl_lotout_date:            nd(r.GENRL_LOTOUT_DE),
      compltn_date:                 nd(r.COMPLTN_DE),
      transfr_notifc_date:          nd(r.TRANSFR_NOTIFC_DE),
      now_proplsn_matr_desc:        r.NOW_PROPLSN_MATR_DESC,
      synced_at: new Date().toISOString(),
    }));

    const { error, count } = await supabase
      .from("gyeonggi_zones")
      .upsert(records, { onConflict: "source_id", count: "exact" });

    if (error) {
      return NextResponse.json({ saved: 0, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: count ?? records.length });
  } catch (e) {
    console.error("[sync-gyeonggi] error:", e);
    return NextResponse.json(
      { saved: 0, error: `서버 오류: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

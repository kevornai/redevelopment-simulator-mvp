import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const rows = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ saved: 0, synced: 0, error: "rows가 비어있습니다." });
    }

    const supabase = await createClient();

    // 1. stage_timeline_raw upsert
    const timelineRows = rows.map((r: Record<string, string | null>) => ({
      zone_name:                r.IMPRV_ZONE_NM,
      sido:                     "경기도",
      sigungu:                  r.SIGUN_NM,
      project_type:             r.BIZ_TYPE_NM === "재건축" ? "reconstruction" : r.BIZ_TYPE_NM === "재개발" ? "redevelopment" : null,
      date_zone_designation:    r.IMPRV_ZONE_APPONT_FIRST_DE || null,
      date_promotion_committee: r.PROPLSN_COMMISN_APRV_DE || null,
      date_association:         r.ASSOCTN_FOUND_CONFMTN_DE || null,
      date_implementation:      r.BIZ_IMPLMTN_CONFMTN_DE || null,
      date_management_disposal: r.MANAGE_DISPOSIT_CONFMTN_DE || null,
      date_construction_start:  r.STRCONTR_DE || null,
      date_general_sale:        r.GENRL_LOTOUT_DE || null,
      date_completion:          r.COMPLTN_DE || null,
      source:                   "gyeonggi_api",
      source_id:                `${r.SIGUN_CD}_${(r.IMPRV_ZONE_NM ?? "").replace(/\s+/g, "_")}`,
    }));

    // source_id 중복 제거 (같은 배치 내 중복 시 ON CONFLICT 에러 방지)
    const deduped = Array.from(
      new Map(timelineRows.map(r => [r.source_id, r])).values()
    );

    const { error: tlErr } = await supabase
      .from("stage_timeline_raw")
      .upsert(deduped, { onConflict: "source,source_id" });

    if (tlErr) {
      return NextResponse.json({ saved: 0, synced: 0, error: tlErr.message });
    }

    // 2. zones_data 동기화 — NULL 필드만 업데이트
    const { data: zones } = await supabase
      .from("zones_data")
      .select("id,zone_name,sigungu,zone_designation_date,association_approval_date,project_implementation_date,management_disposal_date,construction_start_date");

    let synced = 0;
    for (const zone of (zones ?? []) as Array<{
      id: unknown; zone_name: string | null; sigungu: string | null;
      zone_designation_date: string | null; association_approval_date: string | null;
      project_implementation_date: string | null; management_disposal_date: string | null;
      construction_start_date: string | null;
    }>) {
      if (!zone.zone_name) continue;
      const parts = zone.zone_name.split("_").filter(Boolean);
      const keyTerm = parts.find(p => /구역|지구|재건축|재개발/.test(p)) ?? parts[parts.length - 1] ?? zone.zone_name;
      const match = deduped.find(r => r.zone_name?.includes(keyTerm) || keyTerm.includes(r.zone_name ?? ""));
      if (!match) continue;

      const update: Record<string, string> = {};
      if (!zone.zone_designation_date    && match.date_zone_designation)    update.zone_designation_date    = match.date_zone_designation;
      if (!zone.association_approval_date && match.date_association)         update.association_approval_date = match.date_association;
      if (!zone.project_implementation_date && match.date_implementation)    update.project_implementation_date = match.date_implementation;
      if (!zone.management_disposal_date  && match.date_management_disposal) update.management_disposal_date  = match.date_management_disposal;
      if (!zone.construction_start_date   && match.date_construction_start)  update.construction_start_date   = match.date_construction_start;
      if (!Object.keys(update).length) continue;

      const { error } = await supabase.from("zones_data").update(update).eq("id", zone.id);
      if (!error) synced++;
    }

    return NextResponse.json({ saved: deduped.length, synced });
  } catch (e) {
    console.error("[sync-gyeonggi] error:", e);
    return NextResponse.json(
      { saved: 0, synced: 0, error: `서버 오류: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

/**
 * 구역 추가/수정/삭제 API
 * POST  /api/admin/zones-upsert          → 추가(add) or 수정(edit)
 * DELETE /api/admin/zones-upsert?id=xxx  → 삭제
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

function auth(_req: NextRequest) { return true; }

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY || !address) return null;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` }, signal: AbortSignal.timeout(5000) }
    );
    const json = await res.json();
    const doc = json.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch { return null; }
}

// 신규 구역 기본값
const DEFAULTS = {
  avg_appraisal_rate: 1.3,
  base_project_months: 72,
  t_admin_remaining: 12,
  delay_conflict: 24,
  months_to_construction_start: 24,
  current_construction_cost: 9500000,
  r_recent: 0.007,
  r_long: 0.002,
  decay_factor: 0.04,
  alpha: 0.002,
  peak_local: 100000000,
  mdd_local: 0.22,
  member_sale_price_source: "cost_estimated",
  neighbor_new_apt_price: 2000000000,
  pf_loan_ratio: 0.5,
  annual_pf_rate: 0.065,
  total_floor_area: 200000,
  general_sale_area: 70000,
  member_sale_area: 130000,
  holding_loan_ratio: 0.6,
  annual_holding_rate: 0.042,
  reconstruction_safety_passed: true,
  existing_apt_pyung: null,
  acquisition_tax_rate: 0.028,
  move_out_cost: 5000000,
  target_yield_rate: 0.08,
  contribution_at_construction: 0.5,
  construction_start_announced_ym: null,
};

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { zone, mode } = await req.json();
  if (!zone?.zone_id) return NextResponse.json({ error: "zone_id 필수" }, { status: 400 });

  const supabase = createAdminClient();

  // 주소가 있으면 지오코딩
  let coords: { lat: number; lng: number } | null = null;
  if (zone.address) coords = await geocode(zone.address);

  // gyeonggi_zones에서 관리자가 직접 수정할 수 있는 필드만 패치
  const patch: Record<string, unknown> = {
    lawd_cd: zone.lawd_cd || null,
  };
  if (coords) { patch.lat = coords.lat; patch.lng = coords.lng; }

  if (mode === "add") {
    // 경기도 API 동기화로 추가되는 구역은 여기서 추가 불가 — 403 반환
    return NextResponse.json({ error: "구역 추가는 경기도 API 동기화로만 가능합니다." }, { status: 403 });
  } else {
    const { error } = await supabase.from("gyeonggi_zones").update(patch).eq("zone_id", zone.zone_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, geocoded: !!coords });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("gyeonggi_zones").delete().eq("zone_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

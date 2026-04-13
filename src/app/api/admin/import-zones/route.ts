/**
 * 관리자 전용 구역 일괄 임포트 API
 * POST /api/admin/import-zones
 * 신규: 카카오 REST API 지오코딩으로 대표지번 → lat/lng 자동 변환
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY ?? "";

// 신규 구역 INSERT 시 기본값
const DEFAULT_ROW = {
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
  p_base: 70000000,
  peak_local: 100000000,
  mdd_local: 0.22,
  member_sale_price_per_pyung: 55000000,
  member_sale_price_source: "cost_estimated",
  neighbor_new_apt_price: 2000000000,
  pf_loan_ratio: 0.5,
  annual_pf_rate: 0.065,
  total_floor_area: 200000,
  total_appraisal_value: 3000000000000,
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

interface ZoneInput {
  zoneId: string;
  name: string;
  gu: string;
  address: string;   // 대표지번
  projectType: string;
  projectStage: string;
  lawdCd: string;
}

/** 카카오 지오코딩: 주소 → lat/lng */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY || !address) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent("서울 " + address)}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const doc = json.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (ADMIN_SECRET) {
    const auth = req.headers.get("x-admin-secret");
    if (auth !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json();
  const zones: ZoneInput[] = body.zones ?? [];

  if (!zones.length) {
    return NextResponse.json({ error: "zones 배열이 비어있습니다." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("zones_data")
    .select("zone_id, lat, lng")
    .in("zone_id", zones.map((z) => z.zoneId));

  const existingMap = new Map(
    (existing ?? []).map((r: { zone_id: string; lat: number | null; lng: number | null }) => [r.zone_id, r])
  );

  let upserted = 0;
  let skipped = 0;

  for (const zone of zones) {
    if (!zone.zoneId) { skipped++; continue; }

    // 좌표 지오코딩 (기존에 없을 때만)
    const ex = existingMap.get(zone.zoneId);
    let coords: { lat: number; lng: number } | null = null;
    if (!ex?.lat && zone.address) {
      coords = await geocode(zone.address);
    }

    if (ex) {
      // 기존 구역: stage / type / lawd_cd + 좌표(없으면) 업데이트
      const patch: Record<string, unknown> = {
        project_stage: zone.projectStage,
        project_type: zone.projectType,
        lawd_cd: zone.lawdCd || null,
        zone_name: zone.name,
        updated_at: new Date().toISOString(),
      };
      if (coords) { patch.lat = coords.lat; patch.lng = coords.lng; }

      const { error } = await supabase
        .from("zones_data")
        .update(patch)
        .eq("zone_id", zone.zoneId);

      if (!error) upserted++;
      else { console.error(zone.zoneId, error); skipped++; }
    } else {
      // 신규 INSERT
      const { error } = await supabase
        .from("zones_data")
        .insert({
          ...DEFAULT_ROW,
          zone_id: zone.zoneId,
          zone_name: zone.name,
          project_type: zone.projectType,
          project_stage: zone.projectStage,
          lawd_cd: zone.lawdCd || null,
          avg_appraisal_rate: zone.projectType === "reconstruction" ? 1.05 : 1.3,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });

      if (!error) upserted++;
      else { console.error(zone.zoneId, error); skipped++; }
    }

    // 지오코딩 rate limit 방지
    if (coords) await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ upserted, skipped, total: zones.length });
}

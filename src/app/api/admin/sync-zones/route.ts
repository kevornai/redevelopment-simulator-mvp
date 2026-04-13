/**
 * 관리자 전용 구역 데이터 동기화 API
 * POST /api/admin/sync-zones          → 전체 동기화
 * POST /api/admin/sync-zones?id=banpo → 단일 구역 동기화
 *
 * 보안: ADMIN_SECRET 헤더 검증
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllZones, syncZone } from "@/lib/zone-sync";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

export async function POST(req: NextRequest) {
  // 인증 (Vercel 환경변수 ADMIN_SECRET 필요)
  if (ADMIN_SECRET) {
    const authHeader = req.headers.get("x-admin-secret");
    if (authHeader !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const zoneId = searchParams.get("id");

  if (zoneId) {
    // 단일 구역
    const LAWD_MAP: Record<string, string> = {
      banpo: "11650", gaepo: "11680", gaepo4: "11680",
      dunchon: "11740", chamsil: "11710", seocho: "11650",
      nowon: "11350", mokdong: "11470", gwacheon: "41390",
      gwacheon1: "41390", gwacheon2: "41390",
      bundang_sunae: "41135", bundang_seohyeon: "41135",
      pyeongchon: "41171", ilsan: "41285",
    };
    const lawdCd = LAWD_MAP[zoneId];
    if (!lawdCd) {
      return NextResponse.json({ error: `Unknown zoneId: ${zoneId}` }, { status: 400 });
    }
    const result = await syncZone(zoneId, lawdCd);
    return NextResponse.json({ results: [result] });
  }

  // 전체 동기화
  const results = await syncAllZones();

  const summary = {
    total: results.length,
    success: results.filter((r) => r.success).length,
    scraped: results.filter((r) => r.cleansysFromScrape).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  return NextResponse.json(summary);
}

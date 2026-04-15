import { NextRequest, NextResponse } from "next/server";
import { fetchBuildingFloorArea } from "@/lib/market-data/building-registry";

export async function GET(req: NextRequest) {
  const key       = process.env.MOLIT_API_KEY ?? "";
  const sigunguCd = req.nextUrl.searchParams.get("sigunguCd") ?? "41113";
  const bjdongCd  = req.nextUrl.searchParams.get("bjdongCd")  ?? "13100";
  const bldNm     = req.nextUrl.searchParams.get("bldNm")     ?? "성일아파트";

  if (!key) return NextResponse.json({ error: "MOLIT_API_KEY 없음" }, { status: 500 });

  const result = await fetchBuildingFloorArea(key, sigunguCd, bjdongCd, bldNm);
  return NextResponse.json({ sigunguCd, bjdongCd, bldNm, ...result });
}

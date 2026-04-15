import { NextRequest, NextResponse } from "next/server";

const BR_BASE = "http://apis.data.go.kr/1613000/ArchPmsService_v2/getBrTitleInfo";

export async function GET(req: NextRequest) {
  const key       = process.env.MOLIT_API_KEY ?? "";
  const sigunguCd = req.nextUrl.searchParams.get("sigunguCd") ?? "41113";
  const bjdongCd  = req.nextUrl.searchParams.get("bjdongCd")  ?? "13100";
  const bldNm     = req.nextUrl.searchParams.get("bldNm")     ?? "성일아파트";

  if (!key) return NextResponse.json({ error: "MOLIT_API_KEY 없음" }, { status: 500 });

  const params = new URLSearchParams({ serviceKey: key, sigunguCd, bjdongCd, bldNm, numOfRows: "5", pageNo: "1" });
  const url = `${BR_BASE}?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    return NextResponse.json({ sigunguCd, bjdongCd, bldNm, httpStatus: res.status, rawPreview: text.slice(0, 1000) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

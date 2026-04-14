import { NextRequest, NextResponse } from "next/server";

const MOLIT_BASE = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";

export async function GET(req: NextRequest) {
  const key = process.env.MOLIT_API_KEY ?? "";
  const lawdCd = req.nextUrl.searchParams.get("lawdCd") ?? "41113";

  if (!key) {
    return NextResponse.json({ error: "MOLIT_API_KEY 환경변수 없음" }, { status: 500 });
  }

  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`; // 이번 달

  const url = `${MOLIT_BASE}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&numOfRows=3&pageNo=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();

    // XML 또는 JSON 응답 그대로 반환
    const isXml = text.trimStart().startsWith("<");
    return NextResponse.json({
      lawdCd,
      ym,
      status: res.status,
      keyLength: key.length,
      responsePreview: text.slice(0, 800),
      isXml,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

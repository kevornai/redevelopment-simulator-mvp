import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. 환경변수 존재 여부
  results.env = {
    ECOS: !!process.env.ECOS_API_KEY,
    KOSIS: !!process.env.KOSIS_API_KEY,
    MOLIT: !!process.env.MOLIT_API_KEY,
    NSDI: !!process.env.NSDI_API_KEY,
  };

  // 2. ECOS 실제 호출
  try {
    const key = process.env.ECOS_API_KEY ?? "";
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/5/722Y001/M/202401/202501/0101000`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    results.ecos = { status: res.status, rows: json?.StatisticSearch?.row?.length ?? 0, raw: JSON.stringify(json).slice(0, 200) };
  } catch (e) { results.ecos = { error: String(e) }; }

  // 3. KOSIS 실제 호출
  try {
    const key = process.env.KOSIS_API_KEY ?? "";
    const params = new URLSearchParams({
      method: "getList", apiKey: key, itmId: "T10", objL1: "ALL",
      format: "json", jsonVD: "Y",
      userStatsId: "403/MT_DTITD01/MT_DTITD01/A/2/2/",
      statsId: "403_MT_DTITD01",
      prdSe: "M", startPrdDe: "202401", endPrdDe: "202501",
    });
    const res = await fetch(`https://kosis.kr/openapi/Param/statisticsParameterData.do?${params}`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    results.kosis = { status: res.status, isArray: Array.isArray(json), length: Array.isArray(json) ? json.length : 0, raw: JSON.stringify(json).slice(0, 300) };
  } catch (e) { results.kosis = { error: String(e) }; }

  // 4. MOLIT 실제 호출 (성남시 41130, 2024년 12월)
  try {
    const key = process.env.MOLIT_API_KEY ?? "";
    const params = new URLSearchParams({ serviceKey: key, LAWD_CD: "41130", DEAL_YMD: "202412", numOfRows: "5", pageNo: "1" });
    const res = await fetch(`https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${params}`, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    results.molit = { status: res.status, hasItem: text.includes("<item>"), raw: text.slice(0, 300) };
  } catch (e) { results.molit = { error: String(e) }; }

  return NextResponse.json(results);
}

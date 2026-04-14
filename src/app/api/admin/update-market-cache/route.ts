/**
 * 시장 데이터 캐시 업데이트
 * POST /api/admin/update-market-cache
 *
 * GitHub Actions 월간 cron 또는 수동으로 호출.
 * KOSIS/ECOS를 직접 호출하고 Supabase market_cache 테이블에 저장.
 * GitHub Actions는 KR IP 허용됨 → KOSIS 접근 가능.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KOSIS_BASE = "https://kosis.kr/openapi/Param/statisticsParameterData.do";
const ECOS_BASE = "https://ecos.bok.or.kr/api";

function ymToDate(ym: string): Date {
  return new Date(parseInt(ym.slice(0, 4)), parseInt(ym.slice(4, 6)) - 1, 1);
}
function calcMonthlyRate(series: { ym: string; value: number }[], months: number): number {
  if (series.length < 2) return 0.003;
  const latest = series[series.length - 1];
  const cutoff = new Date(ymToDate(latest.ym));
  cutoff.setMonth(cutoff.getMonth() - months);
  let base = series[0];
  for (const s of series) { if (ymToDate(s.ym) >= cutoff) { base = s; break; } }
  const m = (ymToDate(latest.ym).getFullYear() - ymToDate(base.ym).getFullYear()) * 12
    + ymToDate(latest.ym).getMonth() - ymToDate(base.ym).getMonth();
  if (m <= 0 || base.value <= 0) return 0.003;
  return Math.pow(latest.value / base.value, 1 / m) - 1;
}

export async function POST() {
  const supabase = createAdminClient();
  const results: Record<string, unknown> = {};

  // ── KOSIS 건설공사비지수 ──────────────────────────────────────
  try {
    const kosisKey = process.env.KOSIS_API_KEY ?? "";
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 132, 1);
    const params = new URLSearchParams({
      method: "getList", apiKey: kosisKey, itmId: "T10", objL1: "ALL",
      format: "json", jsonVD: "Y",
      userStatsId: "403/MT_DTITD01/MT_DTITD01/A/2/2/",
      statsId: "403_MT_DTITD01", prdSe: "M",
      startPrdDe: `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}`,
      endPrdDe: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`,
    });
    const res = await fetch(`${KOSIS_BASE}?${params}`, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    const rows: Array<{ PRD_DE: string; DT: string }> = Array.isArray(json) ? json : [];
    if (rows.length > 0) {
      const series = rows
        .map(r => ({ ym: r.PRD_DE.replace("-", "").slice(0, 6), value: parseFloat(r.DT) }))
        .filter(s => !isNaN(s.value))
        .sort((a, b) => a.ym.localeCompare(b.ym));
      const payload = {
        rRecent: calcMonthlyRate(series, 36),
        rLong: calcMonthlyRate(series, 120),
        currentIndex: series[series.length - 1].value,
        basePeriod: series[series.length - 1].ym,
        fromApi: true,
      };
      await supabase.from("market_cache").upsert({ key: "construction_cost", value: payload, fetched_at: new Date().toISOString(), source: "kosis" });
      results.kosis = { ok: true, basePeriod: payload.basePeriod, rRecent: payload.rRecent };
    } else {
      results.kosis = { ok: false, error: "빈 응답" };
    }
  } catch (e) {
    results.kosis = { ok: false, error: String(e) };
  }

  // ── ECOS 금리 ────────────────────────────────────────────────
  try {
    const ecosKey = process.env.ECOS_API_KEY ?? "";
    const now = new Date();
    const start = `${now.getFullYear() - 1}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [baseRes, mortRes] = await Promise.all([
      fetch(`${ECOS_BASE}/StatisticSearch/${ecosKey}/json/kr/1/20/722Y001/M/${start}/${end}/0101000`),
      fetch(`${ECOS_BASE}/StatisticSearch/${ecosKey}/json/kr/1/20/721Y002/M/${start}/${end}/BEAF`),
    ]);
    const [baseJson, mortJson] = await Promise.all([baseRes.json(), mortRes.json()]);
    const baseRows = baseJson?.StatisticSearch?.row ?? [];
    const mortRows = mortJson?.StatisticSearch?.row ?? [];
    const baseRate = baseRows.length ? parseFloat(baseRows[baseRows.length - 1].DATA_VALUE) / 100 : 0.03;
    const mortRate = mortRows.length ? parseFloat(mortRows[mortRows.length - 1].DATA_VALUE) / 100 : 0.042;
    const payload = {
      baseRate, mortgageRate: mortRate,
      pfRate: baseRate + 0.03,
      targetYield: baseRate + 0.035,
      fromApi: true,
    };
    await supabase.from("market_cache").upsert({ key: "rates", value: payload, fetched_at: new Date().toISOString(), source: "ecos" });
    results.ecos = { ok: true, baseRate, mortRate };
  } catch (e) {
    results.ecos = { ok: false, error: String(e) };
  }

  return NextResponse.json(results);
}

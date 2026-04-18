#!/usr/bin/env tsx
// cleansys.or.kr 등 한국 정부 사이트 중간 CA 누락 문제 우회 (배치 스크립트 전용)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * 정비사업 통계 배치 수집 스크립트
 *
 * 실행:
 *   npx tsx scripts/collect-stats.ts              # 전체 수집
 *   npx tsx scripts/collect-stats.ts --max-pages 3 # 테스트 (3페이지만)
 *   npx tsx scripts/collect-stats.ts --dry-run     # 저장 없이 수집만 확인
 *
 * 처리:
 *   1. 정비몽땅 전수 스크래핑 → stage_timeline_raw 저장
 *   2. 관리처분계획서 PDF 파싱 → discount_rate_raw 저장
 *   3. 집계 통계 계산 → market_cache.stage_stats / market_cache.discount_rates
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { scrapeAllProjects, ProjectDetail } from "./lib/cleansys-batch";
import { parsePdfFromUrl, DiscountRateItem } from "./lib/pdf-parser";

// ── 경기도 정비사업 현황 API (GenrlimprvBizpropls) ─────────────────────
const GYEONGGI_API_BASE = "https://openapi.gg.go.kr/GenrlimprvBizpropls";
const GYEONGGI_API_KEY  = process.env.GYEONGGI_OPEN_API_KEY ?? "6f7cae6f12fb49dea44a0f30e1611919";

interface GyeonggiApiRow {
  SIGUN_NM:                   string;
  SIGUN_CD:                   string;
  BIZ_TYPE_NM:                string; // '재건축' | '재개발' | ...
  IMPRV_ZONE_NM:              string;
  IMPRV_ZONE_APPONT_FIRST_DE: string | null;
  IMPRV_PLAN_FOUNDNG_DE:      string | null;
  PROPLSN_COMMISN_APRV_DE:    string | null;
  ASSOCTN_FOUND_CONFMTN_DE:   string | null;
  BIZ_IMPLMTN_CONFMTN_DE:     string | null;
  MANAGE_DISPOSIT_CONFMTN_DE: string | null;
  STRCONTR_DE:                string | null;
  GENRL_LOTOUT_DE:            string | null;
  COMPLTN_DE:                 string | null;
}

async function fetchGyeonggiApiRows(
  onProgress?: (msg: string) => void,
): Promise<GyeonggiApiRow[]> {
  const all: GyeonggiApiRow[] = [];
  let page = 1;
  let total: number | null = null;

  while (true) {
    const url =
      `${GYEONGGI_API_BASE}?KEY=${GYEONGGI_API_KEY}&Type=json&pIndex=${page}&pSize=100`;
    const res = await fetch(url, {
      headers: {
        "Referer":    "https://data.gg.go.kr",
        "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
      },
    });
    if (!res.ok) throw new Error(`경기도 API HTTP ${res.status}`);

    const data = await res.json() as { GenrlimprvBizpropls: Array<Record<string, unknown>> };
    const root = data?.GenrlimprvBizpropls ?? [];
    if (!root || root.length < 2) break;

    const headList = (root[0] as { head: Array<Record<string, unknown>> }).head ?? [];
    if (total === null) {
      total = (headList[0] as { list_total_count: number }).list_total_count ?? 0;
    }
    const resultCode = ((headList[1] as { RESULT: { CODE: string } })?.RESULT?.CODE) ?? "";
    if (resultCode !== "INFO-000") {
      onProgress?.(`  경기도 API 오류: ${resultCode} (page ${page})`);
      break;
    }

    const rows = ((root[1] as { row?: GyeonggiApiRow[] }).row) ?? [];
    all.push(...rows);
    onProgress?.(`  경기도 API page ${page}: ${rows.length}건 → 누계 ${all.length}/${total}`);

    if (all.length >= total || rows.length === 0) break;
    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  return all;
}

function mapGyeonggiToTimelineRow(r: GyeonggiApiRow) {
  const projectType =
    r.BIZ_TYPE_NM === "재건축" ? "reconstruction" :
    r.BIZ_TYPE_NM === "재개발" ? "redevelopment"  : null;
  const sourceId = `${r.SIGUN_CD}_${r.IMPRV_ZONE_NM.replace(/\s+/g, "_")}`;

  return {
    zone_name:                r.IMPRV_ZONE_NM,
    sido:                     "경기도",
    sigungu:                  r.SIGUN_NM,
    project_type:             projectType,
    date_zone_designation:    r.IMPRV_ZONE_APPONT_FIRST_DE   || null,
    date_promotion_committee: r.PROPLSN_COMMISN_APRV_DE       || null,
    date_association:         r.ASSOCTN_FOUND_CONFMTN_DE      || null,
    date_implementation:      r.BIZ_IMPLMTN_CONFMTN_DE        || null,
    date_management_disposal: r.MANAGE_DISPOSIT_CONFMTN_DE    || null,
    date_construction_start:  r.STRCONTR_DE                   || null,
    date_general_sale:        r.GENRL_LOTOUT_DE               || null,
    date_completion:          r.COMPLTN_DE                    || null,
    source:                   "gyeonggi_api",
    source_id:                sourceId,
  };
}

// ── .env.local 로드 (로컬 개발용, CI는 환경변수 직접 주입) ─────────────
function loadEnvLocal() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    const content = fs.readFileSync(".env.local", "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local 없음 → CI 환경 (env vars 직접 주입)
  }
}

// ── CLI 인수 파싱 ──────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let maxPages = 0;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max-pages" && args[i + 1]) {
      maxPages = parseInt(args[++i], 10);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { maxPages, dryRun };
}

// ── 백분위 계산 (정수 반올림) ─────────────────────────────────────────
function pctileInt(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return Math.round(sorted[lo]);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

// 소수 4자리 백분위 (할인율용)
function pctileF(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return parseFloat(sorted[lo].toFixed(4));
  const v = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  return parseFloat(v.toFixed(4));
}

// ── 날짜 간 개월 수 계산 ──────────────────────────────────────────────
function monthsBetween(from: string, to: string): number {
  const d1 = new Date(from);
  const d2 = new Date(to);
  return (d2.getFullYear() - d1.getFullYear()) * 12
    + (d2.getMonth() - d1.getMonth());
}

// ── 지역 유형 분류 ────────────────────────────────────────────────────
function classifyRegion(sido: string | null, sigungu: string | null): string {
  const GANGNAM_GU = ["강남구", "서초구", "송파구", "강동구"];
  if (sigungu && GANGNAM_GU.some(gu => sigungu.includes(gu))) return "gangnam";
  if (sido?.includes("서울") || sigungu?.includes("서울")) return "seoul_other";
  if (sido?.includes("경기") || sido?.includes("인천") ||
      sigungu?.includes("경기") || sigungu?.includes("인천")) return "gyeonggi_incheon";
  return "local";
}

// ── Supabase 배치 upsert ──────────────────────────────────────────────
async function upsertBatch<T extends object>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  chunkSize = 100,
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: "source,source_id" });
    if (error) {
      console.error(`  [upsert error] ${table}: ${error.message}`);
      errors++;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, errors };
}

// ── 단계 통계 계산 ────────────────────────────────────────────────────
type StageKey =
  | "zone_designation"
  | "promotion_committee"
  | "association"
  | "implementation"
  | "management_disposal";

const STAGE_DATE_COLS: Record<StageKey, string> = {
  zone_designation:    "date_zone_designation",
  promotion_committee: "date_promotion_committee",
  association:         "date_association",
  implementation:      "date_implementation",
  management_disposal: "date_management_disposal",
};

interface StageRow {
  project_type:               string | null;
  date_zone_designation:      string | null;
  date_promotion_committee:   string | null;
  date_association:           string | null;
  date_implementation:        string | null;
  date_management_disposal:   string | null;
  date_construction_start:    string | null;
}

function computeStageStats(rows: StageRow[]) {
  type Bucket = Record<StageKey, number[]>;
  const byType: Record<string, Bucket> = {};

  const ensureBucket = (type: string): Bucket => {
    if (!byType[type]) {
      byType[type] = {} as Bucket;
      for (const k of Object.keys(STAGE_DATE_COLS) as StageKey[]) {
        byType[type][k] = [];
      }
    }
    return byType[type];
  };

  for (const row of rows) {
    if (!row.date_construction_start) continue;
    const ptype = row.project_type ?? "unknown";
    const bucket = ensureBucket(ptype);
    const allBucket = ensureBucket("all");

    for (const [stageKey, col] of Object.entries(STAGE_DATE_COLS) as [StageKey, string][]) {
      const stageDate = (row as unknown as Record<string, string | null>)[col];
      if (!stageDate) continue;
      const months = monthsBetween(stageDate, row.date_construction_start);
      if (months > 0 && months < 600) { // sanity: 0 ~ 50년
        bucket[stageKey].push(months);
        allBucket[stageKey].push(months);
      }
    }
  }

  const result: Record<string, Record<string, { p25: number; p50: number; p75: number; n: number }>> = {};
  for (const [ptype, bucket] of Object.entries(byType)) {
    result[ptype] = {};
    for (const [stageKey, durations] of Object.entries(bucket) as [StageKey, number[]][]) {
      if (durations.length === 0) continue;
      result[ptype][stageKey] = {
        p25: pctileInt(durations, 25),
        p50: pctileInt(durations, 50),
        p75: pctileInt(durations, 75),
        n:   durations.length,
      };
    }
  }
  return result;
}

// ── 할인율 통계 계산 ──────────────────────────────────────────────────
interface DiscountRow {
  sido:          string | null;
  sigungu:       string | null;
  discount_rate: number | string | null;
}

function computeDiscountStats(rows: DiscountRow[]) {
  const byRegion: Record<string, number[]> = {
    gangnam:          [],
    seoul_other:      [],
    gyeonggi_incheon: [],
    local:            [],
    all:              [],
  };

  for (const row of rows) {
    if (row.discount_rate == null) continue;
    const rate = Number(row.discount_rate);
    if (isNaN(rate) || rate <= 0 || rate >= 1) continue;
    const region = classifyRegion(row.sido, row.sigungu);
    byRegion[region].push(rate);
    byRegion.all.push(rate);
  }

  const result: Record<string, { p25: number; p50: number; p75: number; n: number }> = {};
  for (const [region, rates] of Object.entries(byRegion)) {
    if (rates.length === 0) continue;
    result[region] = {
      p25: pctileF(rates, 25),
      p50: pctileF(rates, 50),
      p75: pctileF(rates, 75),
      n:   rates.length,
    };
  }
  return result;
}

// ── 메인 ─────────────────────────────────────────────────────────────
async function main() {
  loadEnvLocal();
  const { maxPages, dryRun } = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("환경변수 누락: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();
  console.log("\n═══════════════════════════════════════════");
  console.log("  정비사업 통계 배치 수집 시작");
  console.log(`  maxPages=${maxPages || "전체"}, dryRun=${dryRun}`);
  console.log(`  시작: ${new Date().toLocaleString("ko-KR")}`);
  console.log("═══════════════════════════════════════════\n");

  // ── Step 1. 정비몽땅 스크래핑 ─────────────────────────────────────
  console.log("[Step 1] 정비몽땅 전수 스크래핑...");
  const projects = await scrapeAllProjects(maxPages, msg => console.log(`  ${msg}`));
  console.log(`  수집 완료: ${projects.length}건\n`);

  // ── Step 1b. 경기도 정비사업 현황 API ────────────────────────────
  console.log("[Step 1b] 경기도 정비사업 현황 API 수집 (GenrlimprvBizpropls)...");
  let gyeonggiApiRows: ReturnType<typeof mapGyeonggiToTimelineRow>[] = [];
  try {
    const rawRows = await fetchGyeonggiApiRows(msg => console.log(msg));
    gyeonggiApiRows = rawRows.map(mapGyeonggiToTimelineRow);
    console.log(`  경기도 API 수집 완료: ${gyeonggiApiRows.length}건`);

    if (!dryRun) {
      const { inserted, errors } = await upsertBatch(supabase, "stage_timeline_raw", gyeonggiApiRows);
      console.log(`  stage_timeline_raw (gyeonggi_api): ${inserted}건 저장, ${errors}건 오류\n`);
    } else {
      const constrCnt = gyeonggiApiRows.filter(r => r.date_construction_start).length;
      console.log(`  [dry-run] ${gyeonggiApiRows.length}건 저장 건너뜀 (착공완료 ${constrCnt}건)\n`);
    }
  } catch (e) {
    console.error(`  경기도 API 수집 실패: ${e}\n`);
  }

  // ── Step 2. stage_timeline_raw 저장 ──────────────────────────────
  console.log("[Step 2] stage_timeline_raw 저장 (정비몽땅)...");
  const timelineRows = projects.map((p: ProjectDetail) => ({
    zone_name:                p.zoneName,
    sido:                     p.sido || null,
    sigungu:                  p.sigungu || null,
    project_type:             p.projectType,
    date_zone_designation:    p.dateZoneDesignation,
    date_promotion_committee: p.datePromotionCommittee,
    date_association:         p.dateAssociation,
    date_implementation:      p.dateImplementation,
    date_management_disposal: p.dateManagementDisposal,
    date_construction_start:  p.dateConstructionStart,
    date_general_sale:        p.dateGeneralSale,
    date_completion:          p.dateCompletion,
    source:                   "cleansys_national",
    source_id:                p.proId,
  }));

  if (!dryRun) {
    const { inserted, errors } = await upsertBatch(supabase, "stage_timeline_raw", timelineRows);
    console.log(`  stage_timeline_raw: ${inserted}건 저장, ${errors}건 오류\n`);
  } else {
    console.log(`  [dry-run] ${timelineRows.length}건 저장 건너뜀\n`);
  }

  // ── Step 3. 관리처분계획서 PDF 파싱 → discount_rate_raw ───────────
  const pdfProjects = projects.filter((p: ProjectDetail) => p.managementDisposalPdfUrl);
  console.log(`[Step 3] PDF 파싱 시작 (${pdfProjects.length}건 대상)...`);

  const discountRows: object[] = [];
  let pdfOk = 0;
  let pdfFail = 0;
  let pdfEmpty = 0;

  for (const proj of pdfProjects) {
    try {
      const items: DiscountRateItem[] = await parsePdfFromUrl(proj.managementDisposalPdfUrl!);
      if (items.length === 0) {
        pdfEmpty++;
      } else {
        const year = proj.dateManagementDisposal
          ? parseInt(proj.dateManagementDisposal.slice(0, 4), 10)
          : null;
        for (const item of items) {
          discountRows.push({
            zone_name:                proj.zoneName,
            sido:                     proj.sido || null,
            sigungu:                  proj.sigungu || null,
            region_type:              classifyRegion(proj.sido, proj.sigungu),
            pyung_type:               item.pyungType,
            member_sale_price:        item.memberSalePrice,
            general_sale_price:       item.generalSalePrice,
            discount_rate:            item.discountRate.toFixed(4),
            management_disposal_year: year,
            pdf_url:                  proj.managementDisposalPdfUrl,
            source:                   "cleansys_national",
            source_id:                `${proj.proId}_${item.pyungType}`,
          });
        }
        console.log(`  [OK] ${proj.zoneName}: ${items.map(i => i.pyungType).join(", ")}`);
        pdfOk++;
      }
    } catch {
      pdfFail++;
    }
  }

  const elapsed1 = Math.round((Date.now() - startTime) / 1000);
  console.log(
    `  PDF 파싱 결과: 성공 ${pdfOk}건, 파싱불가 ${pdfEmpty}건, 오류 ${pdfFail}건` +
    `  → 할인율 데이터 ${discountRows.length}건 (${elapsed1}초 경과)`
  );

  if (!dryRun && discountRows.length > 0) {
    const { inserted, errors } = await upsertBatch(supabase, "discount_rate_raw", discountRows);
    console.log(`  discount_rate_raw: ${inserted}건 저장, ${errors}건 오류\n`);
  } else if (dryRun) {
    console.log(`  [dry-run] ${discountRows.length}건 저장 건너뜀\n`);
  } else {
    console.log(`  PDF 파싱 결과 없음 — discount_rate_raw 저장 건너뜀\n`);
  }

  // ── Step 4. 집계 통계 계산 → market_cache ────────────────────────
  console.log("[Step 4] 집계 통계 계산 및 market_cache 업데이트...");

  if (!dryRun) {
    // DB 전체 데이터 기준으로 재계산 (이번 배치 + 기존 누적 포함)
    const { data: stageData, error: stageErr } = await supabase
      .from("stage_timeline_raw")
      .select(
        "project_type," +
        "date_zone_designation,date_promotion_committee,date_association," +
        "date_implementation,date_management_disposal,date_construction_start"
      )
      .not("date_construction_start", "is", null);

    if (stageErr) {
      console.error(`  [stage query error] ${stageErr.message}`);
    } else {
      const stageStats = computeStageStats((stageData ?? []) as unknown as StageRow[]);
      await supabase.from("market_cache").upsert({
        key:        "stage_stats",
        value:      stageStats,
        fetched_at: new Date().toISOString(),
        source:     "cleansys_national",
      });
      const typeSummary = Object.entries(stageStats)
        .map(([k, v]) => `${k}(${Object.values(v).reduce((s, e) => s + e.n, 0)}건)`)
        .join(", ");
      console.log(`  stage_stats 저장 완료: ${typeSummary}`);
    }

    const { data: discountData, error: discountErr } = await supabase
      .from("discount_rate_raw")
      .select("sido,sigungu,discount_rate");

    if (discountErr) {
      console.error(`  [discount query error] ${discountErr.message}`);
    } else {
      const discountStats = computeDiscountStats((discountData ?? []) as DiscountRow[]);
      await supabase.from("market_cache").upsert({
        key:        "discount_rates",
        value:      discountStats,
        fetched_at: new Date().toISOString(),
        source:     "cleansys_national",
      });
      const regionSummary = Object.entries(discountStats)
        .map(([k, v]) => `${k}:p50=${v.p50}(n=${v.n})`)
        .join(", ");
      console.log(`  discount_rates 저장 완료: ${regionSummary}`);
    }
  } else {
    // dry-run: 현재 배치 데이터만으로 미리보기
    const stageStats = computeStageStats(timelineRows.map(r => ({
      project_type:               r.project_type,
      date_zone_designation:      r.date_zone_designation,
      date_promotion_committee:   r.date_promotion_committee,
      date_association:           r.date_association,
      date_implementation:        r.date_implementation,
      date_management_disposal:   r.date_management_disposal,
      date_construction_start:    r.date_construction_start,
    })));
    console.log("  [dry-run] stage_stats 미리보기:");
    console.log(JSON.stringify(stageStats, null, 2));

    const discountStats = computeDiscountStats(
      (discountRows as Array<{ sido: string | null; sigungu: string | null; discount_rate: string }>)
        .map(r => ({ sido: r.sido, sigungu: r.sigungu, discount_rate: r.discount_rate }))
    );
    console.log("  [dry-run] discount_rates 미리보기:");
    console.log(JSON.stringify(discountStats, null, 2));
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  console.log("\n═══════════════════════════════════════════");
  console.log(`  배치 완료 (${mins}분 ${secs}초)`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch(e => {
  console.error("배치 실패:", e);
  process.exit(1);
});

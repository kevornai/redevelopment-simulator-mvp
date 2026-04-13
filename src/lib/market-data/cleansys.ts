/**
 * 정비사업 정보몽땅 (cleansys.or.kr) 스크래퍼
 * 공식 공개 API 없음 → HTML fetch + 파싱
 * 가져오는 데이터: 사업단계, 착공/준공 예정일, 세대수
 */

export interface CleansysData {
  projectStage?: string;    // 우리 schema 값 (zone_designation 등)
  constructionStartYm?: string; // YYYYMM
  completionYm?: string;    // YYYYMM
  totalUnitsAfter?: number; // 건립 세대수
  rawStageName?: string;    // 원본 텍스트 (디버깅용)
  fromScrape: boolean;
}

// 정비몽땅 사업단계 텍스트 → 우리 schema 매핑
const STAGE_TEXT_MAP: Record<string, string> = {
  "구역지정": "zone_designation",
  "기본계획": "basic_plan",
  "추진위원회": "zone_designation",
  "추진위": "zone_designation",
  "조합설립": "basic_plan",
  "조합설립인가": "basic_plan",
  "사업시행인가": "project_implementation",
  "사업시행": "project_implementation",
  "관리처분인가": "management_disposal",
  "관리처분": "management_disposal",
  "이주": "relocation",
  "이주철거": "relocation",
  "철거": "relocation",
  "착공": "construction_start",
  "준공": "completion",
  "입주": "completion",
  "완료": "completion",
};

/** 사업단계 텍스트 → schema 값 변환 (부분 매칭) */
function mapStageText(raw: string): string | undefined {
  const normalized = raw.replace(/\s+/g, "").replace(/[()]/g, "");
  for (const [key, val] of Object.entries(STAGE_TEXT_MAP)) {
    if (normalized.includes(key)) return val;
  }
  return undefined;
}

/** YYYYMM 형식으로 날짜 텍스트 파싱 */
function parseYearMonth(text: string): string | undefined {
  // "2025.06", "2025년 06월", "202506", "2025-06" 등 처리
  const m = text.match(/(\d{4})[.\-년\s]*(\d{1,2})/);
  if (!m) return undefined;
  const year = m[1];
  const month = m[2].padStart(2, "0");
  return `${year}${month}`;
}

/** HTML에서 텍스트 추출 (태그 제거) */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** <td> 내용 배열로 추출 */
function extractTableCells(html: string): string[] {
  const cells: string[] = [];
  const regex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    cells.push(stripTags(m[1]));
  }
  return cells;
}

// ── 서울시 클린업 시스템 ─────────────────────────────────────
const SEOUL_BASE = "https://cleanup.seoul.go.kr";

/**
 * 서울시 클린업시스템에서 구역 검색
 * 서울 구역 전용 (강남/강동/송파/서초/양천/노원)
 */
async function fetchSeoulCleanup(
  keyword: string,
  sigunguCd: string
): Promise<CleansysData> {
  try {
    // 1단계: 목록 검색 (AJAX)
    const listUrl = `${SEOUL_BASE}/cleanup/ajaxLscrLegaldong.do`;
    const searchBody = new URLSearchParams({
      searchType: "1",
      sigunguCd,
      keyword,
      pageIndex: "1",
      pageUnit: "10",
    });

    const listRes = await fetch(listUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        Referer: `${SEOUL_BASE}/cleanup/listLscrLeg.do`,
      },
      body: searchBody.toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const listHtml = await listRes.text();

    // 프로젝트 ID 추출 (href 패턴)
    const idMatch = listHtml.match(/detailLscrLeg\.do\?[^"']*id=(\d+)/);
    if (!idMatch) {
      // 직접 단계 텍스트 파싱 시도 (목록 페이지에서)
      return parseStageFromHtml(listHtml, keyword);
    }

    const projectId = idMatch[1];

    // 2단계: 상세 페이지
    const detailUrl = `${SEOUL_BASE}/cleanup/detailLscrLeg.do?id=${projectId}`;
    const detailRes = await fetch(detailUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        Referer: listUrl,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!detailRes.ok) throw new Error(`detail HTTP ${detailRes.status}`);
    const detailHtml = await detailRes.text();

    return parseDetailHtml(detailHtml);
  } catch (e) {
    console.warn(`[cleansys] Seoul fetch failed for "${keyword}":`, e);
    return { fromScrape: false };
  }
}

// ── 국토부 클린업시스템 (cleansys.or.kr) ─────────────────────
const NATIONAL_BASE = "https://www.cleansys.or.kr";

/**
 * 국토부 클린업시스템 (비서울 경기도 등)
 */
async function fetchNationalCleanup(
  keyword: string,
  sidoCd: string,
  sigunguCd: string
): Promise<CleansysData> {
  try {
    // 목록 페이지
    const searchUrl = new URL(`${NATIONAL_BASE}/rls/rlsProList.do`);
    searchUrl.searchParams.set("sidoCd", sidoCd);
    searchUrl.searchParams.set("sigunguCd", sigunguCd);
    searchUrl.searchParams.set("proNm", keyword);
    searchUrl.searchParams.set("pageIndex", "1");

    const res = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        Referer: `${NATIONAL_BASE}/rls/rlsMain.do`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // 상세 링크 추출
    const detailMatch = html.match(/rlsProDetail\.do\?[^"']*proId=([^"'&]+)/);
    if (detailMatch) {
      const detailUrl = `${NATIONAL_BASE}/rls/rlsProDetail.do?proId=${detailMatch[1]}`;
      const detailRes = await fetch(detailUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        signal: AbortSignal.timeout(8000),
      });
      if (detailRes.ok) {
        return parseDetailHtml(await detailRes.text());
      }
    }

    return parseStageFromHtml(html, keyword);
  } catch (e) {
    console.warn(`[cleansys] National fetch failed for "${keyword}":`, e);
    return { fromScrape: false };
  }
}

/** HTML에서 사업단계 / 날짜 직접 파싱 */
function parseStageFromHtml(html: string, _keyword: string): CleansysData {
  const text = stripTags(html);
  const result: CleansysData = { fromScrape: false };

  // 단계 텍스트 탐색
  for (const key of Object.keys(STAGE_TEXT_MAP)) {
    if (text.includes(key)) {
      result.projectStage = STAGE_TEXT_MAP[key];
      result.rawStageName = key;
      result.fromScrape = true;
      break;
    }
  }

  return result;
}

/** 상세 페이지 HTML 파싱 */
function parseDetailHtml(html: string): CleansysData {
  const result: CleansysData = { fromScrape: true };
  const cells = extractTableCells(html);

  for (let i = 0; i < cells.length - 1; i++) {
    const label = cells[i].trim();
    const value = cells[i + 1].trim();

    if (label.includes("현재단계") || label.includes("사업단계") || label.includes("추진단계")) {
      const stage = mapStageText(value);
      if (stage) {
        result.projectStage = stage;
        result.rawStageName = value;
      }
    }

    if (label.includes("착공") && (label.includes("예정") || label.includes("일자") || label.includes("일"))) {
      const ym = parseYearMonth(value);
      if (ym) result.constructionStartYm = ym;
    }

    if (label.includes("준공") || label.includes("입주")) {
      if (label.includes("예정") || label.includes("일자") || label.includes("일")) {
        const ym = parseYearMonth(value);
        if (ym) result.completionYm = ym;
      }
    }

    if (label.includes("건립") && label.includes("세대")) {
      const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(num) && num > 0) result.totalUnitsAfter = num;
    }
  }

  // th-td 패턴도 시도
  const thTdRegex = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = thTdRegex.exec(html)) !== null) {
    const label = stripTags(m[1]);
    const value = stripTags(m[2]);

    if ((label.includes("단계") || label.includes("진행")) && !result.projectStage) {
      const stage = mapStageText(value);
      if (stage) {
        result.projectStage = stage;
        result.rawStageName = value;
      }
    }
    if (label.includes("착공") && !result.constructionStartYm) {
      const ym = parseYearMonth(value);
      if (ym) result.constructionStartYm = ym;
    }
    if ((label.includes("준공") || label.includes("입주")) && !result.completionYm) {
      const ym = parseYearMonth(value);
      if (ym) result.completionYm = ym;
    }
  }

  return result;
}

// ── 구역 ID → 검색 파라미터 매핑 ──────────────────────────────
interface ZoneSearchMeta {
  keyword: string;
  sidoCd: string;
  sigunguCd: string;
  source: "seoul" | "national";
}

const ZONE_CLEANSYS_MAP: Record<string, ZoneSearchMeta> = {
  banpo:    { keyword: "반포주공1단지",  sidoCd: "11", sigunguCd: "11650", source: "seoul" },
  gaepo:    { keyword: "개포주공1단지",  sidoCd: "11", sigunguCd: "11680", source: "seoul" },
  gaepo4:   { keyword: "개포4단지",      sidoCd: "11", sigunguCd: "11680", source: "seoul" },
  dunchon:  { keyword: "둔촌주공",       sidoCd: "11", sigunguCd: "11740", source: "seoul" },
  chamsil:  { keyword: "잠실주공5단지",  sidoCd: "11", sigunguCd: "11710", source: "seoul" },
  seocho:   { keyword: "서초구역",       sidoCd: "11", sigunguCd: "11650", source: "seoul" },
  nowon:    { keyword: "노원",           sidoCd: "11", sigunguCd: "11350", source: "seoul" },
  mokdong:  { keyword: "목동",           sidoCd: "11", sigunguCd: "11470", source: "seoul" },
  gwacheon: { keyword: "주공7단지",      sidoCd: "41", sigunguCd: "41390", source: "national" },
  gwacheon1:{ keyword: "과천1구역",      sidoCd: "41", sigunguCd: "41390", source: "national" },
  gwacheon2:{ keyword: "과천2구역",      sidoCd: "41", sigunguCd: "41390", source: "national" },
  bundang_sunae:    { keyword: "수내",   sidoCd: "41", sigunguCd: "41135", source: "national" },
  bundang_seohyeon: { keyword: "서현",   sidoCd: "41", sigunguCd: "41135", source: "national" },
  pyeongchon: { keyword: "평촌",         sidoCd: "41", sigunguCd: "41171", source: "national" },
  ilsan:    { keyword: "일산",           sidoCd: "41", sigunguCd: "41285", source: "national" },
};

/**
 * 구역 ID로 정비몽땅 데이터 조회
 * @param zoneId - zones.ts의 key
 */
export async function fetchCleansysData(zoneId: string): Promise<CleansysData> {
  const meta = ZONE_CLEANSYS_MAP[zoneId];
  if (!meta) return { fromScrape: false };

  if (meta.source === "seoul") {
    return fetchSeoulCleanup(meta.keyword, meta.sigunguCd);
  } else {
    return fetchNationalCleanup(meta.keyword, meta.sidoCd, meta.sigunguCd);
  }
}

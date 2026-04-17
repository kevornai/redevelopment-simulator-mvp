/**
 * 정비사업 정보몽땅 (cleansys.or.kr) 배치 스크래퍼
 *
 * 목적:
 *   - 전국 완료/진행 중 사업의 단계별 날짜 수집 → stage_timeline_raw
 *   - 관리처분인가 완료 사업의 계획서 PDF URL 수집 → discount_rate_raw 연산 재료
 *
 * 전략:
 *   1. rlsProList.do 페이지네이션으로 전 사업 목록 수집
 *   2. 사업시행인가 이후 단계만 상세 페이지 fetch (나머지는 날짜 없어서 무의미)
 *   3. 상세 페이지에서 단계별 날짜 + 문서 목록 파싱
 *   4. 관리처분계획서 PDF URL 반환 (파싱은 collect-stats.ts에서)
 */

const NATIONAL_BASE = "https://www.cleansys.or.kr";
const DELAY_MS = 600; // 요청 간 딜레이 (rate limit 준수)

export interface ProjectListItem {
  proId: string;
  zoneName: string;
  sido: string;
  sigungu: string;
  projectType: string | null;  // '재건축' | '재개발' | null
  currentStage: string;        // 원본 텍스트
}

export interface ProjectDetail {
  proId: string;
  zoneName: string;
  sido: string;
  sigungu: string;
  projectType: string | null;
  // 단계별 날짜 (ISO date string, YYYY-MM-DD)
  dateZoneDesignation:    string | null;
  datePromotionCommittee: string | null;
  dateAssociation:        string | null;
  dateImplementation:     string | null;
  dateManagementDisposal: string | null;
  dateConstructionStart:  string | null;
  dateGeneralSale:        string | null;
  dateCompletion:         string | null;
  // 관리처분계획서 PDF URL (있는 경우)
  managementDisposalPdfUrl: string | null;
}

/** 딜레이 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** HTML 태그 제거 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 날짜 텍스트 → ISO date (YYYY-MM-DD)
 * 입력 예: "2019.03.15", "2019년 3월", "20190315", "2019-03"
 */
function parseDate(text: string): string | null {
  if (!text || text.trim() === "" || text.includes("-") && text.length < 5) return null;
  // YYYY.MM.DD 또는 YYYY-MM-DD
  const full = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (full) {
    const y = full[1], m = full[2].padStart(2,"0"), d = full[3].padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  // YYYY.MM 또는 YYYY년 MM월
  const ym = text.match(/(\d{4})[.\-년\s]+(\d{1,2})/);
  if (ym) {
    const y = ym[1], m = ym[2].padStart(2,"0");
    return `${y}-${m}-01`;
  }
  return null;
}

/** 사업 유형 텍스트 → 'reconstruction' | 'redevelopment' | null */
function parseProjectType(text: string): string | null {
  if (text.includes("재건축")) return "reconstruction";
  if (text.includes("재개발")) return "redevelopment";
  return null;
}

/**
 * 목록 페이지 1페이지 스크래핑
 * @returns items + 전체 페이지 수
 */
async function fetchListPage(pageIndex: number): Promise<{ items: ProjectListItem[]; totalPages: number }> {
  const url = new URL(`${NATIONAL_BASE}/rls/rlsProList.do`);
  url.searchParams.set("pageIndex", String(pageIndex));
  url.searchParams.set("pageUnit", "20");
  url.searchParams.set("sidoCd", "");
  url.searchParams.set("sigunguCd", "");
  url.searchParams.set("proNm", "");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`list HTTP ${res.status}`);
  const html = await res.text();

  // 전체 건수 파싱 → 페이지 수 계산
  const totalMatch = html.match(/총\s*[\s\S]*?(\d[\d,]+)\s*건/);
  const totalCount = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ""), 10) : 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / 20) : 1;

  const items: ProjectListItem[] = [];

  // tr 행 파싱
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // proId 추출 (rlsProDetail.do?proId=XXX 링크에서)
    const proIdMatch = rowHtml.match(/proId=([A-Z0-9_-]+)/i);
    if (!proIdMatch) continue;

    const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    const cellTexts = cells.map(c => stripTags(c));

    if (cellTexts.length < 4) continue;

    // 열 순서: 번호 | 시도 | 시군구 | 사업명 | 사업유형 | 현재단계 | ...
    items.push({
      proId: proIdMatch[1],
      sido: cellTexts[1] || "",
      sigungu: cellTexts[2] || "",
      zoneName: cellTexts[3] || "",
      projectType: parseProjectType(cellTexts[4] || ""),
      currentStage: cellTexts[5] || "",
    });
  }

  return { items, totalPages };
}

/**
 * 상세 페이지에서 단계별 날짜 + 문서 URL 파싱
 */
async function fetchProjectDetail(item: ProjectListItem): Promise<ProjectDetail> {
  const url = `${NATIONAL_BASE}/rls/rlsProDetail.do?proId=${item.proId}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
      Referer: `${NATIONAL_BASE}/rls/rlsProList.do`,
    },
    signal: AbortSignal.timeout(10000),
  });

  const detail: ProjectDetail = {
    proId: item.proId,
    zoneName: item.zoneName,
    sido: item.sido,
    sigungu: item.sigungu,
    projectType: item.projectType,
    dateZoneDesignation: null,
    datePromotionCommittee: null,
    dateAssociation: null,
    dateImplementation: null,
    dateManagementDisposal: null,
    dateConstructionStart: null,
    dateGeneralSale: null,
    dateCompletion: null,
    managementDisposalPdfUrl: null,
  };

  if (!res.ok) return detail;
  const html = await res.text();

  // th-td 쌍 파싱 (라벨: 값)
  const thTdRegex = /<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = thTdRegex.exec(html)) !== null) {
    const label = stripTags(m[1]).replace(/\s/g, "");
    const value = stripTags(m[2]);
    const parsed = parseDate(value);

    if (label.includes("구역지정") || label.includes("정비구역지정"))
      detail.dateZoneDesignation = parsed;
    else if (label.includes("추진위") || label.includes("위원회승인"))
      detail.datePromotionCommittee = parsed;
    else if (label.includes("조합설립") || label.includes("조합인가"))
      detail.dateAssociation = parsed;
    else if (label.includes("사업시행인가") || label.includes("사업시행"))
      detail.dateImplementation = parsed;
    else if (label.includes("관리처분인가") || label.includes("관리처분"))
      detail.dateManagementDisposal = parsed;
    else if (label.includes("착공") && label.includes("일"))
      detail.dateConstructionStart = parsed;
    else if (label.includes("일반분양") || label.includes("분양일"))
      detail.dateGeneralSale = parsed;
    else if (label.includes("준공") || label.includes("입주"))
      detail.dateCompletion = parsed;
  }

  // 문서 목록에서 관리처분계획서 PDF 링크 추출
  // 패턴: 문서명에 "관리처분" 포함하는 <a href="...">
  const docRegex = /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = docRegex.exec(html)) !== null) {
    const href = m[1];
    const linkText = stripTags(m[2]);
    if (linkText.includes("관리처분") || linkText.includes("관리처분계획")) {
      detail.managementDisposalPdfUrl = href.startsWith("http")
        ? href
        : `${NATIONAL_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
      break;
    }
  }

  // PDF가 없으면 문서 다운로드 패턴도 시도 (JavaScript onclick, fileDown 등)
  if (!detail.managementDisposalPdfUrl) {
    const fileDownRegex = /fileDown[^(]*\(['"]([^'"]+)['"]/g;
    while ((m = fileDownRegex.exec(html)) !== null) {
      // 앞뒤 텍스트에 "관리처분" 있는지 확인
      const ctx = html.substring(Math.max(0, m.index - 200), m.index + 200);
      if (ctx.includes("관리처분")) {
        detail.managementDisposalPdfUrl = m[1].startsWith("http")
          ? m[1]
          : `${NATIONAL_BASE}/fileDown?fileId=${m[1]}`;
        break;
      }
    }
  }

  return detail;
}

/** 현재 단계가 사업시행 이후인지 판단 (날짜 수집 가치 있는 단계) */
function isRelevantStage(stage: string): boolean {
  const relevant = ["사업시행", "관리처분", "이주", "철거", "착공", "준공", "입주", "완료"];
  return relevant.some(s => stage.includes(s));
}

/**
 * 정비몽땅 전수 배치 스크래핑
 *
 * @param maxPages 최대 페이지 수 (0 = 전체, 테스트 시 소수 지정)
 * @param onProgress 진행 콜백 (선택)
 * @returns 수집된 ProjectDetail 배열
 */
export async function scrapeAllProjects(
  maxPages = 0,
  onProgress?: (msg: string) => void,
): Promise<ProjectDetail[]> {
  const log = (msg: string) => {
    if (onProgress) onProgress(msg);
    else console.log(msg);
  };

  // 1페이지로 전체 페이지 수 파악
  log("[1/N] 목록 1페이지 조회 중...");
  const { items: firstItems, totalPages } = await fetchListPage(1);
  const pages = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;
  log(`전체 ${totalPages}페이지, ${maxPages > 0 ? `${pages}페이지까지` : "전체"} 처리`);

  // 목록 수집
  const allItems: ProjectListItem[] = [...firstItems];
  for (let p = 2; p <= pages; p++) {
    await sleep(DELAY_MS);
    try {
      const { items } = await fetchListPage(p);
      allItems.push(...items);
      if (p % 10 === 0) log(`목록 ${p}/${pages} 페이지 수집 (${allItems.length}건)`);
    } catch (e) {
      log(`목록 ${p}페이지 실패: ${e}`);
    }
  }
  log(`목록 수집 완료: ${allItems.length}건`);

  // 관련 단계 필터링
  const relevant = allItems.filter(item => isRelevantStage(item.currentStage));
  log(`관련 단계 (사업시행 이후): ${relevant.length}건 → 상세 조회 시작`);

  // 상세 페이지 수집
  const details: ProjectDetail[] = [];
  for (let i = 0; i < relevant.length; i++) {
    await sleep(DELAY_MS);
    try {
      const detail = await fetchProjectDetail(relevant[i]);
      details.push(detail);
    } catch (e) {
      log(`상세 실패 [${relevant[i].proId}]: ${e}`);
      details.push({
        ...relevant[i],
        dateZoneDesignation: null, datePromotionCommittee: null,
        dateAssociation: null, dateImplementation: null,
        dateManagementDisposal: null, dateConstructionStart: null,
        dateGeneralSale: null, dateCompletion: null,
        managementDisposalPdfUrl: null,
      });
    }
    if ((i + 1) % 50 === 0) log(`상세 ${i + 1}/${relevant.length} 완료`);
  }

  log(`상세 수집 완료: ${details.length}건`);
  return details;
}

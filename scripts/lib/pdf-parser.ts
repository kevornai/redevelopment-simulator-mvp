/**
 * 관리처분계획서 PDF 파서
 *
 * 목적: 조합원분양가 + 일반분양예정가 추출 → 할인율 계산
 *
 * 관리처분계획서 분양가 표 공통 패턴:
 *   - "84A형  조합원분양가  450,000만원  일반분양예정가  620,000만원"
 *   - "전용59㎡ / 조합원: 32,000만원 / 일반: 44,000만원"
 *   - 금액 단위: 만원 (가장 흔함), 원, 억원
 */

import pdfParse from "pdf-parse";

export interface DiscountRateItem {
  pyungType: string;        // 평형 유형 (예: '84A', '59B')
  memberSalePrice: number;  // 조합원분양가 (원)
  generalSalePrice: number; // 일반분양예정가 (원)
  discountRate: number;     // memberSalePrice / generalSalePrice
}

/** 금액 텍스트 → 원 단위 변환 */
function parsePrice(raw: string): number | null {
  const clean = raw.replace(/,/g, "").trim();

  // 억원 단위
  const eok = clean.match(/^([\d.]+)\s*억/);
  if (eok) return Math.round(parseFloat(eok[1]) * 1_0000_0000);

  // 만원 단위
  const man = clean.match(/^([\d.]+)\s*만/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);

  // 순수 숫자 (원 단위 — 보통 매우 큰 수)
  const num = clean.match(/^(\d+)$/);
  if (num) {
    const n = parseInt(num[1], 10);
    // 100만 이하면 만원 단위로 간주 (관리처분계획서 관행)
    return n < 100_0000 ? n * 10000 : n;
  }

  return null;
}

/** 평형 유형 텍스트 정규화 (예: "전용84.94㎡(A)" → "84A") */
function normalizePyungType(raw: string): string {
  // 숫자 + 영문 알파벳 조합 추출 (예: 84A, 59B, 114C)
  const m = raw.match(/(\d{2,3})[^0-9]*([A-Za-z])?/);
  if (!m) return raw.replace(/\s+/g, "").substring(0, 10);
  return m[1] + (m[2] ? m[2].toUpperCase() : "");
}

/**
 * PDF Buffer에서 조합원/일반분양가 테이블 파싱
 */
export async function parseMgmtDisposalPdf(buffer: Buffer): Promise<DiscountRateItem[]> {
  let text: string;
  try {
    const data = await pdfParse(buffer, { max: 0 }); // max:0 = 전체 페이지
    text = data.text;
  } catch {
    return []; // 이미지 PDF 등 파싱 불가
  }

  if (!text || text.length < 100) return [];

  const results: DiscountRateItem[] = [];

  // ── 패턴 1: 분양가 테이블 라인 파싱 ──────────────────────────────────────
  // 예: "84A  450,000  620,000"  (만원 단위 2열)
  // 또는: "59B형 조합원분양가 32,000만원 일반분양예정가 44,000만원"
  const lines = text.split(/\n/);

  // 조합원분양가 / 일반분양예정가 섹션 감지 플래그
  let inPriceSection = false;
  const PRICE_SECTION_KEYWORDS = ["분양가", "조합원분양", "일반분양예정", "분양금액"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 섹션 진입 감지
    if (PRICE_SECTION_KEYWORDS.some(k => line.includes(k))) {
      inPriceSection = true;
    }

    if (!inPriceSection) continue;

    // 패턴 A: 한 줄에 평형 + 조합원가 + 일반가 모두
    // "84A  45,000만원  62,000만원" 또는 "84A형 조합원 450,000 일반 620,000"
    const patternA = line.match(
      /([가-힣\w]*\d{2,3}[A-Za-z]?[형타입]*)\s+(?:조합원[^\d]*)?([\d,]+)\s*만?원?\s+(?:일반[^\d]*)?([\d,]+)\s*만?원?/
    );
    if (patternA) {
      const memberRaw = patternA[2].replace(/,/g, "");
      const generalRaw = patternA[3].replace(/,/g, "");
      const m = parseInt(memberRaw, 10);
      const g = parseInt(generalRaw, 10);
      if (m > 0 && g > 0 && m < g) { // 조합원가 < 일반가 sanity check
        const memberPrice = m < 100_0000 ? m * 10000 : m;
        const generalPrice = g < 100_0000 ? g * 10000 : g;
        results.push({
          pyungType: normalizePyungType(patternA[1]),
          memberSalePrice: memberPrice,
          generalSalePrice: generalPrice,
          discountRate: memberPrice / generalPrice,
        });
      }
    }

    // 패턴 B: 조합원분양가 라인 → 다음 줄에 일반분양예정가
    const patternBMember = line.match(/조합원\s*분양가[^0-9]*([\d,]+)\s*(만원|원|억원)?/);
    if (patternBMember && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const patternBGeneral = nextLine.match(/일반\s*분양\s*(?:예정가)?[^0-9]*([\d,]+)\s*(만원|원|억원)?/);
      if (patternBGeneral) {
        // 평형은 이전 몇 줄에서 찾기
        let pyungType = "unknown";
        for (let j = Math.max(0, i - 5); j < i; j++) {
          const prevLine = lines[j].trim();
          const pym = prevLine.match(/(\d{2,3}[A-Za-z]?)/);
          if (pym) { pyungType = pym[1]; break; }
        }

        const mRaw = patternBMember[1].replace(/,/g, "");
        const gRaw = patternBGeneral[1].replace(/,/g, "");
        const mUnit = patternBMember[2] || "만원";
        const gUnit = patternBGeneral[2] || "만원";

        const toWon = (v: number, unit: string) => {
          if (unit === "억원") return v * 1_0000_0000;
          if (unit === "만원") return v * 10000;
          return v < 100_0000 ? v * 10000 : v;
        };

        const memberPrice = toWon(parseInt(mRaw, 10), mUnit);
        const generalPrice = toWon(parseInt(gRaw, 10), gUnit);

        if (memberPrice > 0 && generalPrice > 0 && memberPrice < generalPrice) {
          results.push({
            pyungType: normalizePyungType(pyungType),
            memberSalePrice: memberPrice,
            generalSalePrice: generalPrice,
            discountRate: memberPrice / generalPrice,
          });
        }
      }
    }

    // 섹션 이탈 감지 (다음 대섹션 시작)
    if (inPriceSection && line.match(/^(제\d+조|[0-9]+\.|[IVX]+\.)/) &&
        !PRICE_SECTION_KEYWORDS.some(k => line.includes(k))) {
      // 너무 멀리 벗어나면 중단 (분양가 섹션 끝)
      if (results.length > 0) break;
    }
  }

  // 중복 평형 제거 (같은 pyungType은 첫 번째만 유지)
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.pyungType)) return false;
    seen.add(r.pyungType);
    return true;
  });
}

/**
 * URL에서 PDF 다운로드 후 파싱
 */
export async function parsePdfFromUrl(url: string): Promise<DiscountRateItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const buffer = Buffer.from(await res.arrayBuffer());
    return parseMgmtDisposalPdf(buffer);
  } catch {
    return [];
  }
}

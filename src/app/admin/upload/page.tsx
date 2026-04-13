"use client";

import { useState, useCallback } from "react";

// ── 공통 매핑 ─────────────────────────────────────────────────
const STAGE_MAP: Record<string, string> = {
  "구역지정": "zone_designation", "기본계획": "basic_plan",
  "추진위원회": "zone_designation", "추진위": "zone_designation",
  "조합설립": "basic_plan", "조합설립인가": "basic_plan",
  "사업시행인가": "project_implementation", "사업시행": "project_implementation",
  "관리처분인가": "management_disposal", "관리처분": "management_disposal",
  "이주": "relocation", "이주·철거": "relocation", "철거": "relocation",
  "착공": "construction_start",
  "준공": "completion", "입주": "completion", "완료": "completion",
};
const TYPE_MAP: Record<string, string> = {
  "재개발": "redevelopment", "재건축": "reconstruction",
  "주거환경개선": "redevelopment", "도시환경정비": "redevelopment",
  "주거환경": "redevelopment",
};
const SEOUL_LAWD: Record<string, string> = {
  "종로구":"11110","중구":"11140","용산구":"11170","성동구":"11200","광진구":"11215",
  "동대문구":"11230","중랑구":"11260","성북구":"11290","강북구":"11305","도봉구":"11320",
  "노원구":"11350","은평구":"11380","서대문구":"11410","마포구":"11440","양천구":"11470",
  "강서구":"11500","구로구":"11530","금천구":"11545","영등포구":"11560","동작구":"11590",
  "관악구":"11620","서초구":"11650","강남구":"11680","송파구":"11710","강동구":"11740",
};
const GYEONGGI_LAWD: Record<string, string> = {
  "수원시":"41110","성남시":"41130","의정부시":"41150","안양시":"41170","부천시":"41190",
  "광명시":"41210","평택시":"41220","동두천시":"41250","안산시":"41270","고양시":"41280",
  "과천시":"41290","구리시":"41310","남양주시":"41360","오산시":"41370","시흥시":"41390",
  "군포시":"41410","의왕시":"41430","하남시":"41450","용인시":"41460","파주시":"41480",
  "이천시":"41500","안성시":"41550","김포시":"41570","화성시":"41590","광주시":"41610",
  "양주시":"41630","포천시":"41650","여주시":"41670","연천군":"41800","가평군":"41820",
  "양평군":"41830",
};

function mapStage(raw: string): string {
  const c = raw.trim().replace(/\s+/g, "");
  for (const [k, v] of Object.entries(STAGE_MAP)) if (c.includes(k.replace(/\s+/g, ""))) return v;
  return "zone_designation";
}
function mapType(raw: string): string {
  for (const [k, v] of Object.entries(TYPE_MAP)) if (raw.includes(k)) return v;
  return "redevelopment";
}
function getLawdCd(region: string): string {
  return SEOUL_LAWD[region] ?? GYEONGGI_LAWD[region] ??
    Object.entries(GYEONGGI_LAWD).find(([k]) => region.includes(k.replace("시","").replace("군","")))?.[1] ?? "";
}
function generateZoneId(name: string, region: string): string {
  const regionSlug = region.replace(/[시군구]/g, "").slice(0, 4);
  return `${regionSlug}_${name.replace(/\s+/g, "").slice(0, 8)}`
    .toLowerCase().replace(/[^a-z0-9가-힣_]/g, "_");
}
function num(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}
function dateStr(s: string): string | null {
  if (!s || s.trim() === "-" || s.trim() === "") return null;
  // YYYY.MM.DD / YYYY-MM / YYYY / YYYY.MM 등 → YYYYMM
  const m = s.match(/(\d{4})[.\-]?(\d{2})?/);
  if (!m) return null;
  return m[1] + (m[2] ?? "");
}

// ── 파싱 결과 타입 ─────────────────────────────────────────────
interface ParsedRow {
  // 기본
  zoneId: string;
  name: string;
  region: string;
  address: string;
  projectType: string;
  projectStage: string;
  lawdCd: string;
  selected: boolean;
  // 상세
  zone_area_sqm: number | null;
  existing_building_year: number | null;
  existing_units_total: number | null;
  planned_units_total: number | null;
  planned_units_member: number | null;
  planned_units_general: number | null;
  planned_units_rent: number | null;
  new_units_sale_total: number | null;
  new_units_sale_u40: number | null;
  new_units_sale_40_60: number | null;
  new_units_sale_60_85: number | null;
  new_units_sale_85_135: number | null;
  new_units_sale_o135: number | null;
  new_units_rent_total: number | null;
  floor_area_ratio_existing: number | null;
  floor_area_ratio_new: number | null;
  land_owners_count: number | null;
  association_members_count: number | null;
  project_period_start: string | null;
  project_period_end: string | null;
  basic_plan_date: string | null;
  zone_designation_date: string | null;
  zone_designation_change_date: string | null;
  promotion_committee_date: string | null;
  safety_inspection_grade: string | null;
  association_approval_date: string | null;
  project_implementation_date: string | null;
  management_disposal_date: string | null;
  construction_start_date: string | null;
  general_sale_date: string | null;
  completion_date: string | null;
  project_operator: string | null;
}

// ── 서울 포맷 파서 ─────────────────────────────────────────────
// 컬럼: 번호, 자치구, 사업구분, 사업장명, 대표지번, 진행단계, ...
function parseSeoul(lines: string[]): ParsedRow[] {
  return lines.flatMap((line) => {
    const c = line.split("\t");
    if (c.length < 6) return [];
    if (c[0].trim() === "번호") return [];
    const region = c[1]?.trim() ?? "";
    const name = c[3]?.trim() ?? "";
    if (!name || !region) return [];
    return [{
      zoneId: generateZoneId(name, region),
      name, region,
      address: c[4]?.trim() ?? "",
      projectType: mapType(c[2]?.trim() ?? ""),
      projectStage: mapStage(c[5]?.trim() ?? ""),
      lawdCd: getLawdCd(region),
      selected: true,
      zone_area_sqm: null, existing_building_year: null,
      existing_units_total: null, planned_units_total: null,
      planned_units_member: null, planned_units_general: null, planned_units_rent: null,
      new_units_sale_total: null, new_units_sale_u40: null, new_units_sale_40_60: null,
      new_units_sale_60_85: null, new_units_sale_85_135: null, new_units_sale_o135: null,
      new_units_rent_total: null,
      floor_area_ratio_existing: null, floor_area_ratio_new: null,
      land_owners_count: null, association_members_count: null,
      project_period_start: null, project_period_end: null,
      basic_plan_date: null, zone_designation_date: null, zone_designation_change_date: null,
      promotion_committee_date: null, safety_inspection_grade: null,
      association_approval_date: null, project_implementation_date: null,
      management_disposal_date: null, construction_start_date: null,
      general_sale_date: null, completion_date: null, project_operator: null,
    }];
  });
}

// ── 경기도 포맷 파서 ───────────────────────────────────────────
// 컬럼 인덱스 (헤더 2행 병합 구조 → 실제 데이터 행 기준)
// 0:연번 1:시군 2:사업단계 3:사업유형 4:정비구역명 5:위치 6:구역면적
// 7:준공년도 8:동수 9:기존세대계 10~14:평형별
// 15:사업시행합계 16:조합원 17:일반 18:임대
// 19:신축분양계 20~24:평형별 25:신축임대계 26~29:임대평형별
// 30:기존용적률 31:신축용적률 32:토지소유자수 33:조합원수
// 34:사업시행자 35:예정시작 36:예정완료
// 37:기본계획 38:구역지정예정 39:정비계획수립 40:구역지정최초 41:구역지정변경
// 42:추진위승인 43:현지조사예정 44:현지조사실시 45:안전진단등급 46:적정성여부 47:적정성결과
// 48:조합설립인가 49:사업시행인가 50:관리처분인가
// 51:착공일 52:일반분양일 53:준공일 54:이전고시 55:해산 56:청산
// 57:주거환경시행방법 58:국비지원 59:담당자
function parseGyeonggi(lines: string[]): ParsedRow[] {
  return lines.flatMap((line) => {
    const c = line.split("\t");
    if (c.length < 10) return [];
    // 헤더/빈행 스킵
    if (!c[0].trim().match(/^\d+$/)) return [];
    const region = c[1]?.trim() ?? "";
    const name = c[4]?.trim() ?? "";
    if (!name || !region) return [];
    return [{
      zoneId: generateZoneId(name, region),
      name, region,
      address: (region + " " + (c[5]?.trim() ?? "")).trim(),
      projectType: mapType(c[3]?.trim() ?? ""),
      projectStage: mapStage(c[2]?.trim() ?? ""),
      lawdCd: getLawdCd(region),
      selected: true,
      zone_area_sqm: num(c[6] ?? ""),
      existing_building_year: num(c[7] ?? "") ? Math.round(num(c[7] ?? "")!) : null,
      existing_units_total: num(c[9] ?? ""),
      planned_units_total: num(c[15] ?? ""),
      planned_units_member: num(c[16] ?? ""),
      planned_units_general: num(c[17] ?? ""),
      planned_units_rent: num(c[18] ?? ""),
      new_units_sale_total: num(c[19] ?? ""),
      new_units_sale_u40: num(c[20] ?? ""),
      new_units_sale_40_60: num(c[21] ?? ""),
      new_units_sale_60_85: num(c[22] ?? ""),
      new_units_sale_85_135: num(c[23] ?? ""),
      new_units_sale_o135: num(c[24] ?? ""),
      new_units_rent_total: num(c[25] ?? ""),
      floor_area_ratio_existing: num(c[30] ?? ""),
      floor_area_ratio_new: num(c[31] ?? ""),
      land_owners_count: num(c[32] ?? ""),
      association_members_count: num(c[33] ?? ""),
      project_operator: c[34]?.trim() || null,
      project_period_start: c[35]?.trim() || null,
      project_period_end: c[36]?.trim() || null,
      basic_plan_date: dateStr(c[37] ?? ""),
      zone_designation_date: dateStr(c[40] ?? ""),
      zone_designation_change_date: dateStr(c[41] ?? ""),
      promotion_committee_date: dateStr(c[42] ?? ""),
      safety_inspection_grade: c[45]?.trim() || null,
      association_approval_date: dateStr(c[48] ?? ""),
      project_implementation_date: dateStr(c[49] ?? ""),
      management_disposal_date: dateStr(c[50] ?? ""),
      construction_start_date: dateStr(c[51] ?? ""),
      general_sale_date: dateStr(c[52] ?? ""),
      completion_date: dateStr(c[53] ?? ""),
    }];
  });
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
type Format = "seoul" | "gyeonggi";

export default function AdminUploadPage() {
  const [format, setFormat] = useState<Format>("seoul");
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [resultMsg, setResultMsg] = useState("");

  const parse = useCallback(() => {
    const lines = pasteText.trim().split("\n").filter(Boolean);
    const parsed = format === "seoul" ? parseSeoul(lines) : parseGyeonggi(lines);
    setRows(parsed);
    setStatus("idle");
    setResultMsg("");
  }, [pasteText, format]);

  const toggleRow = (i: number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  const toggleAll = (v: boolean) =>
    setRows(prev => prev.map(r => ({ ...r, selected: v })));

  const save = async () => {
    const selected = rows.filter(r => r.selected);
    if (!selected.length) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/import-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": "revo-admin-2026" },
        body: JSON.stringify({ zones: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setStatus("done");
      setResultMsg(`✅ ${data.upserted}개 저장 완료 (${data.skipped}개 스킵)`);
    } catch (e) {
      setStatus("error");
      setResultMsg(`❌ ${e}`);
    }
  };

  const selectedCount = rows.filter(r => r.selected).length;

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">정비사업 데이터 업로드</h1>
            <p className="text-sm text-zinc-500 mt-1">엑셀에서 복사 → 붙여넣기 → DB 저장</p>
          </div>
          <a href="/admin/zones" className="text-sm text-blue-600 hover:underline">← 구역 관리로</a>
        </div>

        {/* 포맷 선택 */}
        <div className="flex gap-2">
          {(["seoul", "gyeonggi"] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => { setFormat(f); setRows([]); }}
              className={`px-4 py-2 text-sm font-medium rounded-xl border ${
                format === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {f === "seoul" ? "🏙 서울시 포맷" : "🌿 경기도 포맷"}
            </button>
          ))}
        </div>

        {/* 포맷 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
          {format === "seoul" ? (
            <>
              <p className="font-semibold">서울시 정비사업 정보몽땅 엑셀 포맷</p>
              <p>컬럼 순서: 번호 · 자치구 · 사업구분 · 사업장명 · 대표지번 · 진행단계 · ...</p>
            </>
          ) : (
            <>
              <p className="font-semibold">경기도 정비사업 현황 엑셀 포맷</p>
              <p>컬럼 순서: 연번 · 시군 · 사업단계 · 사업유형 · 정비구역명 · 위치 · 구역면적 · 준공년도 · 동수 · 기존세대수 · ... · 착공일 · 분양일 · 준공일</p>
              <p className="text-blue-500">헤더 2행 제외하고 데이터 행만 복사해주세요.</p>
            </>
          )}
        </div>

        {/* 붙여넣기 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
          <textarea
            className="w-full h-40 text-xs font-mono border border-zinc-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={format === "seoul"
              ? "번호\t자치구\t사업구분\t사업장명\t대표지번\t진행단계..."
              : "1\t성남시\t관리처분인가\t재개발\t신흥2구역\t경기 성남시 수정구...\t"}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <button
            onClick={parse}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
          >
            파싱하기
          </button>
        </div>

        {/* 결과 테이블 */}
        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <p className="text-sm font-semibold text-zinc-700">
                {rows.length}개 파싱됨 · {selectedCount}개 선택
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:underline">전체선택</button>
                <button onClick={() => toggleAll(false)} className="text-xs text-zinc-400 hover:underline">전체해제</button>
                <button
                  onClick={save}
                  disabled={status === "saving" || selectedCount === 0}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40"
                >
                  {status === "saving" ? "저장 중..." : `${selectedCount}개 DB 저장`}
                </button>
              </div>
            </div>

            {resultMsg && (
              <div className={`px-6 py-3 text-sm font-medium ${status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {resultMsg}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">
                      <input type="checkbox" checked={selectedCount === rows.length} onChange={e => toggleAll(e.target.checked)} />
                    </th>
                    <th className="px-3 py-2 text-left font-medium">지역</th>
                    <th className="px-3 py-2 text-left font-medium">구역명</th>
                    <th className="px-3 py-2 text-left font-medium">구분</th>
                    <th className="px-3 py-2 text-left font-medium">단계</th>
                    <th className="px-3 py-2 text-left font-medium">zone_id</th>
                    <th className="px-3 py-2 text-left font-medium">lawd_cd</th>
                    {format === "gyeonggi" && <>
                      <th className="px-3 py-2 text-right font-medium">구역면적(㎡)</th>
                      <th className="px-3 py-2 text-right font-medium">기존세대</th>
                      <th className="px-3 py-2 text-right font-medium">신축분양</th>
                      <th className="px-3 py-2 text-right font-medium">신축임대</th>
                      <th className="px-3 py-2 text-right font-medium">용적률(신축%)</th>
                      <th className="px-3 py-2 text-left font-medium">착공일</th>
                      <th className="px-3 py-2 text-left font-medium">준공일</th>
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {rows.map((row, i) => (
                    <tr key={i} className={`hover:bg-zinc-50 ${!row.selected ? "opacity-40" : ""}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} />
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{row.region}</td>
                      <td className="px-3 py-2 font-medium text-zinc-800">{row.name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${row.projectType === "reconstruction" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                          {row.projectType === "reconstruction" ? "재건축" : "재개발"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{row.projectStage}</td>
                      <td className="px-3 py-2 font-mono text-zinc-400 text-xs">{row.zoneId}</td>
                      <td className="px-3 py-2 font-mono text-zinc-400">{row.lawdCd || <span className="text-red-400">없음</span>}</td>
                      {format === "gyeonggi" && <>
                        <td className="px-3 py-2 text-right text-zinc-600">{row.zone_area_sqm?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-zinc-600">{row.existing_units_total?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-zinc-600">{row.new_units_sale_total?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-zinc-600">{row.new_units_rent_total?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-zinc-600">{row.floor_area_ratio_new ?? "—"}%</td>
                        <td className="px-3 py-2 text-zinc-500">{row.construction_start_date ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.completion_date ?? "—"}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

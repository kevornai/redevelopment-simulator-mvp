"use client";

import { useState, useCallback } from "react";

// ── 진행단계 텍스트 → DB schema 매핑
const STAGE_MAP: Record<string, string> = {
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
  "이주·철거": "relocation",
  "철거": "relocation",
  "착공": "construction_start",
  "준공": "completion",
  "입주": "completion",
  "완료": "completion",
};

// 사업구분 → project_type
const TYPE_MAP: Record<string, string> = {
  "재개발": "redevelopment",
  "재건축": "reconstruction",
  "주거환경개선": "redevelopment",
  "도시환경정비": "redevelopment",
};

// 자치구 → lawd_cd (서울시 시군구 코드)
const LAWD_MAP: Record<string, string> = {
  "종로구": "11110", "중구": "11140", "용산구": "11170",
  "성동구": "11200", "광진구": "11215", "동대문구": "11230",
  "중랑구": "11260", "성북구": "11290", "강북구": "11305",
  "도봉구": "11320", "노원구": "11350", "은평구": "11380",
  "서대문구": "11410", "마포구": "11440", "양천구": "11470",
  "강서구": "11500", "구로구": "11530", "금천구": "11545",
  "영등포구": "11560", "동작구": "11590", "관악구": "11620",
  "서초구": "11650", "강남구": "11680", "송파구": "11710",
  "강동구": "11740",
};

function mapStage(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "");
  for (const [key, val] of Object.entries(STAGE_MAP)) {
    if (cleaned.includes(key.replace(/\s+/g, ""))) return val;
  }
  return "zone_designation";
}

function mapType(raw: string): string {
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (raw.includes(key)) return val;
  }
  return "redevelopment";
}

function generateZoneId(name: string, gu: string): string {
  // 사업장명에서 영문 ID 생성 (간단한 slug)
  const guSlug: Record<string, string> = {
    "강남구": "gangnam", "서초구": "seocho", "송파구": "songpa",
    "강동구": "gangdong", "마포구": "mapo", "용산구": "yongsan",
    "성동구": "seongdong", "동작구": "dongjak", "관악구": "gwanak",
    "영등포구": "yeongdeungpo", "양천구": "yangcheon", "강서구": "gangseo",
    "은평구": "eunpyeong", "서대문구": "seodaemun", "노원구": "nowon",
    "도봉구": "dobong", "강북구": "gangbuk", "성북구": "seongbuk",
    "중랑구": "jungnang", "동대문구": "dongdaemun", "광진구": "gwangjin",
    "중구": "junggu", "종로구": "jongno", "구로구": "guro",
    "금천구": "geumcheon",
  };
  const guPart = guSlug[gu] ?? gu;
  // 숫자 추출
  const numMatch = name.match(/(\d+)/);
  const num = numMatch ? numMatch[1] : "";
  // 키워드 추출
  const keyword = name.replace(/\s+/g, "").replace(/[()（）]/g, "").slice(0, 6);
  return `${guPart}_${keyword}${num}`.replace(/[^a-zA-Z0-9_가-힣]/g, "_").toLowerCase();
}

interface ParsedRow {
  no: string;
  gu: string;
  type: string;
  name: string;
  address: string;
  stage: string;
  // derived
  zoneId: string;
  projectType: string;
  projectStage: string;
  lawdCd: string;
  selected: boolean;
}

export default function AdminUploadPage() {
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [resultMsg, setResultMsg] = useState("");

  const parse = useCallback(() => {
    const lines = pasteText.trim().split("\n").filter(Boolean);
    const parsed: ParsedRow[] = [];

    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length < 6) continue;

      // 헤더 행 스킵
      if (cols[0].trim() === "번호") continue;

      const no = cols[0]?.trim() ?? "";
      const gu = cols[1]?.trim() ?? "";
      const type = cols[2]?.trim() ?? "";
      const name = cols[3]?.trim() ?? "";
      const address = cols[4]?.trim() ?? "";
      const stage = cols[5]?.trim() ?? "";

      if (!name || !gu) continue;

      parsed.push({
        no,
        gu,
        type,
        name,
        address,
        stage,
        zoneId: generateZoneId(name, gu),
        projectType: mapType(type),
        projectStage: mapStage(stage),
        lawdCd: LAWD_MAP[gu] ?? "",
        selected: true,
      });
    }

    setRows(parsed);
    setStatus("idle");
    setResultMsg("");
  }, [pasteText]);

  const toggleRow = (i: number) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const save = async () => {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;

    setStatus("saving");
    try {
      const res = await fetch("/api/admin/import-zones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": "revo-admin-2026",
        },
        body: JSON.stringify({ zones: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setStatus("done");
      setResultMsg(`✅ ${data.upserted}개 저장 완료 (${data.skipped}개 중복 스킵)`);
    } catch (e) {
      setStatus("error");
      setResultMsg(`❌ ${e}`);
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">정비사업 데이터 업로드</h1>
          <p className="text-sm text-zinc-500 mt-1">서울시 정비사업 사업장목록 엑셀에서 복사 → 붙여넣기</p>
        </div>

        {/* 붙여넣기 영역 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
          <p className="text-sm font-medium text-zinc-700">
            엑셀에서 헤더 포함 전체 선택(Ctrl+A) → 복사(Ctrl+C) → 아래에 붙여넣기(Ctrl+V)
          </p>
          <textarea
            className="w-full h-40 text-xs font-mono border border-zinc-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={"번호\t자치구\t사업구분\t사업장명\t대표지번\t진행단계\t...\n1\t강남구\t재건축\t반포주공1단지\t..."}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button
            onClick={parse}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
          >
            파싱하기
          </button>
        </div>

        {/* 파싱 결과 테이블 */}
        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <p className="text-sm font-semibold text-zinc-700">
                파싱 결과 — {rows.length}개 행 ({selectedCount}개 선택됨)
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleAll(true)}
                  className="text-xs text-blue-600 hover:underline"
                >전체 선택</button>
                <button
                  onClick={() => toggleAll(false)}
                  className="text-xs text-zinc-400 hover:underline"
                >전체 해제</button>
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
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selectedCount === rows.length}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">자치구</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">사업장명</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">사업구분</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">진행단계 (원본)</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">project_stage</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">project_type</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">zone_id</th>
                    <th className="px-3 py-2 text-left text-zinc-500 font-medium">lawd_cd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-zinc-50 ${!row.selected ? "opacity-40" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(i)}
                        />
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{row.gu}</td>
                      <td className="px-3 py-2 font-medium text-zinc-800">{row.name}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          row.projectType === "reconstruction"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{row.stage}</td>
                      <td className="px-3 py-2 font-mono text-zinc-700">{row.projectStage}</td>
                      <td className="px-3 py-2 font-mono text-zinc-700">{row.projectType}</td>
                      <td className="px-3 py-2 font-mono text-zinc-500 text-xs">{row.zoneId}</td>
                      <td className="px-3 py-2 font-mono text-zinc-500">{row.lawdCd}</td>
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

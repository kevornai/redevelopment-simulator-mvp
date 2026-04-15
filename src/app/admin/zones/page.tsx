"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ── 타입 ──────────────────────────────────────────────────────
interface ZoneRow {
  zone_id: string;
  zone_name: string | null;
  project_type: "reconstruction" | "redevelopment";
  project_stage: string;
  lawd_cd: string | null;
  lat: number | null;
  lng: number | null;
  p_base: number;
  member_sale_price_per_pyung: number;
  total_appraisal_value: number;
  updated_at: string;
  // 면적 계산 필드
  zone_area_sqm: number | null;
  planned_units_member: number | null;
  floor_area_ratio_new: number | null;
  public_contribution_ratio: number | null;
  incentive_far_bonus: number | null;
  member_avg_pyung: number | null;
  efficiency_ratio: number | null;
}

// ── 상수 ──────────────────────────────────────────────────────
const STAGE_OPTIONS = [
  { value: "zone_designation",       label: "구역지정" },
  { value: "basic_plan",             label: "기본계획" },
  { value: "project_implementation", label: "사업시행인가" },
  { value: "management_disposal",    label: "관리처분인가" },
  { value: "relocation",             label: "이주·철거" },
  { value: "construction_start",     label: "착공" },
  { value: "completion",             label: "준공·입주" },
];

const STAGE_COLOR: Record<string, string> = {
  zone_designation:       "bg-zinc-100 text-zinc-600",
  basic_plan:             "bg-zinc-100 text-zinc-600",
  project_implementation: "bg-amber-100 text-amber-700",
  management_disposal:    "bg-orange-100 text-orange-700",
  relocation:             "bg-red-100 text-red-700",
  construction_start:     "bg-blue-100 text-blue-700",
  completion:             "bg-green-100 text-green-700",
};

const EMPTY_FORM: Omit<ZoneRow, "updated_at"> & { address: string } = {
  zone_id: "",
  zone_name: "",
  project_type: "reconstruction",
  project_stage: "zone_designation",
  lawd_cd: "",
  lat: null,
  lng: null,
  p_base: 70000000,
  member_sale_price_per_pyung: 55000000,
  total_appraisal_value: 3000000000000,
  address: "",
  zone_area_sqm: null,
  planned_units_member: null,
  floor_area_ratio_new: null,
  public_contribution_ratio: null,
  incentive_far_bonus: null,
  member_avg_pyung: null,
  efficiency_ratio: null,
};

function fWon(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(0)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
  return n.toLocaleString();
}

// ── 컴포넌트 ──────────────────────────────────────────────────
export default function AdminZonesPage() {
  const [zones, setZones]       = useState<ZoneRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "reconstruction" | "redevelopment">("all");

  // 모달
  const [modal, setModal]       = useState<"closed" | "add" | "edit">("closed");
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  // 삭제 확인
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/zones-list", {
      headers: { "x-admin-secret": "revo-admin-2026" },
    });
    const d = await res.json();
    setZones(d.zones ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const filtered = zones.filter((z) => {
    const matchType = typeFilter === "all" || z.project_type === typeFilter;
    const matchSearch = !search ||
      (z.zone_name ?? "").includes(search) ||
      z.zone_id.includes(search);
    return matchType && matchSearch;
  });

  // ── 저장 ──
  const save = async () => {
    if (!form.zone_id || !form.zone_name) {
      setMsg("⚠️ 구역 ID와 구역명은 필수입니다.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/zones-upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": "revo-admin-2026",
        },
        body: JSON.stringify({ zone: form, mode: modal }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "저장 실패");
      setMsg("✅ 저장 완료");
      await fetchZones();
      setTimeout(() => { setModal("closed"); setMsg(""); }, 800);
    } catch (e) {
      setMsg(`❌ ${e}`);
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 ──
  const doDelete = async (zoneId: string) => {
    const res = await fetch(`/api/admin/zones-upsert?id=${zoneId}`, {
      method: "DELETE",
      headers: { "x-admin-secret": "revo-admin-2026" },
    });
    if (res.ok) { setDeleteId(null); await fetchZones(); }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setMsg("");
    setModal("add");
  };

  const openEdit = (z: ZoneRow) => {
    setForm({ ...z, address: "" });
    setMsg("");
    setModal("edit");
  };

  // ── 렌더 ──
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-zinc-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">구역 관리</h1>
          <p className="text-xs text-zinc-400 mt-0.5">zones_data 테이블 · 단일 진실 공급원</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/upload"
            className="px-4 py-2 text-sm border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50"
          >
            엑셀 일괄 업로드
          </Link>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
          >
            + 구역 추가
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4 max-w-[1400px] mx-auto">
        {/* 필터 */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="구역명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(["all", "reconstruction", "redevelopment"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                typeFilter === t
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {t === "all" ? `전체 (${zones.length})` : t === "reconstruction" ? `재건축 (${zones.filter(z=>z.project_type==="reconstruction").length})` : `재개발 (${zones.filter(z=>z.project_type==="redevelopment").length})`}
            </button>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">구역명</th>
                    <th className="px-4 py-3 text-left font-medium">ID</th>
                    <th className="px-4 py-3 text-left font-medium">구분</th>
                    <th className="px-4 py-3 text-left font-medium">진행단계</th>
                    <th className="px-4 py-3 text-left font-medium">법정동코드</th>
                    <th className="px-4 py-3 text-left font-medium">좌표</th>
                    <th className="px-4 py-3 text-right font-medium">평당분양가</th>
                    <th className="px-4 py-3 text-right font-medium">총종전평가액</th>
                    <th className="px-4 py-3 text-left font-medium">수정일</th>
                    <th className="px-4 py-3 text-center font-medium">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filtered.map((z) => (
                    <tr key={z.zone_id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {z.zone_name ?? <span className="text-zinc-400">미입력</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{z.zone_id}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          z.project_type === "reconstruction"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}>
                          {z.project_type === "reconstruction" ? "재건축" : "재개발"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLOR[z.project_stage] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {STAGE_OPTIONS.find(s => s.value === z.project_stage)?.label ?? z.project_stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {z.lawd_cd ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {z.lat && z.lng
                          ? <span className="text-green-600 font-medium">✓ {z.lat.toFixed(3)}, {z.lng.toFixed(3)}</span>
                          : <span className="text-zinc-300">미등록</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 font-mono text-xs">
                        {fWon(z.p_base)}/평
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700 font-mono text-xs">
                        {fWon(z.total_appraisal_value)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {new Date(z.updated_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(z)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >수정</button>
                          <button
                            onClick={() => setDeleteId(z.zone_id)}
                            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                          >삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-sm text-zinc-400">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 추가/수정 모달 ── */}
      {modal !== "closed" && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-bold text-zinc-900">{modal === "add" ? "구역 추가" : "구역 수정"}</h2>
              <button onClick={() => setModal("closed")} className="text-zinc-400 hover:text-zinc-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="구역 ID *" hint="영문+숫자+언더스코어만, 변경 불가">
                  <input
                    value={form.zone_id}
                    onChange={(e) => setForm(f => ({ ...f, zone_id: e.target.value }))}
                    disabled={modal === "edit"}
                    className="field-input disabled:bg-zinc-50"
                    placeholder="예: gangnam_xyz1"
                  />
                </Field>
                <Field label="구역명 *">
                  <input
                    value={form.zone_name ?? ""}
                    onChange={(e) => setForm(f => ({ ...f, zone_name: e.target.value }))}
                    className="field-input"
                    placeholder="예: 반포주공1단지"
                  />
                </Field>
                <Field label="사업 구분">
                  <select value={form.project_type} onChange={(e) => setForm(f => ({ ...f, project_type: e.target.value as "reconstruction" | "redevelopment" }))} className="field-input">
                    <option value="reconstruction">재건축</option>
                    <option value="redevelopment">재개발</option>
                  </select>
                </Field>
                <Field label="진행단계">
                  <select value={form.project_stage} onChange={(e) => setForm(f => ({ ...f, project_stage: e.target.value }))} className="field-input">
                    {STAGE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="법정동코드" hint="5자리 시군구 코드 (MOLIT API용)">
                  <input
                    value={form.lawd_cd ?? ""}
                    onChange={(e) => setForm(f => ({ ...f, lawd_cd: e.target.value }))}
                    className="field-input"
                    placeholder="예: 11650"
                    maxLength={5}
                  />
                </Field>
                <Field label="대표 주소" hint="저장 시 자동 지오코딩">
                  <input
                    value={form.address}
                    onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                    className="field-input"
                    placeholder="예: 서울 서초구 반포동 1"
                  />
                </Field>
              </div>

              <hr className="border-zinc-100" />
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">계산 상수</p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="평당 일반분양가 (원)" hint="p_base — API 없을 때 기본값">
                  <input type="number" value={form.p_base} onChange={(e) => setForm(f => ({ ...f, p_base: Number(e.target.value) }))} className="field-input" />
                </Field>
                <Field label="평당 조합원분양가 (원)">
                  <input type="number" value={form.member_sale_price_per_pyung} onChange={(e) => setForm(f => ({ ...f, member_sale_price_per_pyung: Number(e.target.value) }))} className="field-input" />
                </Field>
                <Field label="총종전평가액 (원)">
                  <input type="number" value={form.total_appraisal_value} onChange={(e) => setForm(f => ({ ...f, total_appraisal_value: Number(e.target.value) }))} className="field-input" />
                </Field>
              </div>

              <hr className="border-zinc-100" />
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">면적 계산 <span className="text-zinc-400 font-normal normal-case">— 조합원/일반분양 면적 자동산출</span></p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="구역 면적 (㎡)">
                  <input type="number" value={form.zone_area_sqm ?? ""} onChange={(e) => setForm(f => ({ ...f, zone_area_sqm: e.target.value ? Number(e.target.value) : null }))} className="field-input" placeholder="예: 50000" />
                </Field>
                <Field label="조합원 세대수 (세대)">
                  <input type="number" value={form.planned_units_member ?? ""} onChange={(e) => setForm(f => ({ ...f, planned_units_member: e.target.value ? Number(e.target.value) : null }))} className="field-input" placeholder="예: 500" />
                </Field>
                <Field label="조합원 평균 분양평형 (㎡)" hint="예: 84㎡ (25평형)">
                  <input type="number" value={form.member_avg_pyung ?? ""} onChange={(e) => setForm(f => ({ ...f, member_avg_pyung: e.target.value ? Number(e.target.value) : null }))} className="field-input" placeholder="예: 84" />
                </Field>
                <Field label="재건축 후 용적률 (%)" hint="예: 230 = 230%">
                  <input type="number" step="1" value={form.floor_area_ratio_new ?? ""} onChange={(e) => setForm(f => ({ ...f, floor_area_ratio_new: e.target.value ? Number(e.target.value) : null }))} className="field-input" placeholder="예: 230" />
                </Field>
                <Field label="기부체납률 (%)" hint="예: 10 = 10%">
                  <input type="number" step="1" value={form.public_contribution_ratio != null ? form.public_contribution_ratio * 100 : ""} onChange={(e) => setForm(f => ({ ...f, public_contribution_ratio: e.target.value ? Number(e.target.value) / 100 : null }))} className="field-input" placeholder="예: 10" />
                </Field>
                <Field label="인센티브 추가 용적률 (%)" hint="역세권 등 — 예: 50 = 50%p 추가">
                  <input type="number" step="1" value={form.incentive_far_bonus ?? ""} onChange={(e) => setForm(f => ({ ...f, incentive_far_bonus: e.target.value ? Number(e.target.value) : null }))} className="field-input" placeholder="예: 50" />
                </Field>
              </div>
              {/* 면적 계산 미리보기 */}
              {form.zone_area_sqm && form.floor_area_ratio_new && form.planned_units_member && form.member_avg_pyung && (() => {
                const site = form.zone_area_sqm! * (1 - (form.public_contribution_ratio ?? 0));
                const far = (form.floor_area_ratio_new! + (form.incentive_far_bonus ?? 0)) / 100;
                const net = site * far * (form.efficiency_ratio ?? 0.80);
                const memberArea = form.planned_units_member! * form.member_avg_pyung!;
                const generalArea = Math.max(0, net - memberArea);
                return (
                  <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">계산 미리보기</p>
                    <p>유효 대지 {site.toLocaleString()}㎡ × 용적률 {far.toFixed(2)} = 지상 연면적 {(site * far).toLocaleString()}㎡</p>
                    <p>조합원 분양면적 {memberArea.toLocaleString()}㎡ · 일반분양 가능면적 {generalArea.toLocaleString()}㎡</p>
                  </div>
                );
              })()}

              {msg && (
                <p className={`text-sm font-medium ${msg.startsWith("✅") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
              <button onClick={() => setModal("closed")} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-xl">취소</button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="font-bold text-zinc-900">정말 삭제하시겠습니까?</p>
            <p className="text-sm text-zinc-500"><code className="bg-zinc-100 px-1 rounded">{deleteId}</code> 구역을 삭제하면 복구할 수 없습니다.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-xl">취소</button>
              <button onClick={() => doDelete(deleteId)} className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700">삭제</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field-input {
          width: 100%;
          border: 1px solid #e4e4e7;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 13px;
          outline: none;
        }
        .field-input:focus { ring: 2px; border-color: #3b82f6; }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-600">{label}</label>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      {children}
    </div>
  );
}

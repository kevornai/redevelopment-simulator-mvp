"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  UserInput, DEFAULT_USER_INPUT, Step1Data, UnitsByCategory,
  STAGE_DEFINITIONS, StageDateField,
} from "./types";
import { fetchStep1Data } from "./actions";

const ZoneMap = dynamic(() => import("@/components/map/ZoneMap"), { ssr: false });

interface ZoneListItem {
  zone_id: string;
  zone_name: string | null;
  project_type: string;
  project_stage: string;
}

function fWon(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억원`;
  if (abs >= 10_000_000)  return `${sign}${(abs / 10_000_000).toFixed(1)}천만원`;
  if (abs >= 1_000_000)   return `${sign}${(abs / 1_000_000).toFixed(0)}백만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

// ─── 입력 컴포넌트들 ──────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, placeholder, note, showWon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  note?: string;
  showWon?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showWon && value > 0 && (
        <p className="text-xs font-semibold text-blue-600">{fWon(value)}</p>
      )}
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}

function TextInput({
  label, value, onChange, placeholder, note, mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  note?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className={`border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${mono ? "font-mono" : ""}`}
      />
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}

function NullableNumInput({
  label, value, onChange, placeholder, suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => {
            const s = e.target.value;
            onChange(s === "" ? null : Number(s));
          }}
          placeholder={placeholder ?? "—"}
          className="border border-zinc-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suffix && <span className="text-xs text-zinc-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── 경과 개월 포맷 ───────────────────────────────────────────────────────────
function fElapsed(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월째`;
  if (m === 0) return `${y}년째`;
  return `${y}년 ${m}개월째`;
}

function elapsedFromDate(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

// ─── 정비 단계 타임라인 ───────────────────────────────────────────────────────

function StageTimeline({
  step1,
  setStep1,
}: {
  step1: Step1Data;
  setStep1: React.Dispatch<React.SetStateAction<Step1Data | null>>;
}) {
  // 마지막으로 날짜가 있는 단계 인덱스 = 완료된 마지막 단계
  const lastDoneIdx = STAGE_DEFINITIONS.reduce((acc, def, i) => {
    const val = step1[def.field as StageDateField];
    return val ? i : acc;
  }, -1);

  // 현재 진행 중인 단계 = lastDoneIdx + 1
  const activeIdx = lastDoneIdx + 1;

  // 마지막 완료 날짜로부터 경과 개월
  const lastDoneDef = lastDoneIdx >= 0 ? STAGE_DEFINITIONS[lastDoneIdx] : null;
  const lastDoneDate = lastDoneDef ? step1[lastDoneDef.field as StageDateField] : null;
  const elapsed = lastDoneDate ? elapsedFromDate(lastDoneDate) : null;

  function setDate(field: StageDateField, v: string) {
    setStep1((prev) => prev ? { ...prev, [field]: v || null } : prev);
  }

  return (
    <div className="flex flex-col gap-0">
      {STAGE_DEFINITIONS.map((def, i) => {
        const field = def.field as StageDateField;
        const date = step1[field];
        const isDone   = i <= lastDoneIdx;
        const isActive = i === activeIdx;
        const isFuture = i > activeIdx;

        return (
          <div key={def.key} className={`flex items-start gap-3 py-2.5 border-b border-zinc-50 last:border-0 ${isActive ? "bg-blue-50/40 -mx-1 px-1 rounded-lg" : ""}`}>
            {/* 아이콘 */}
            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              isDone   ? "bg-emerald-500 text-white" :
              isActive ? "bg-blue-500 text-white"    :
                         "bg-zinc-200 text-zinc-400"
            }`}>
              {isDone ? "✓" : isActive ? "→" : ""}
            </div>

            {/* 단계명 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium ${
                  isDone ? "text-zinc-700" : isActive ? "text-blue-700" : "text-zinc-400"
                }`}>
                  {def.label}
                </span>
                {isActive && elapsed != null && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    진행 중 · {fElapsed(elapsed)}
                  </span>
                )}
                {isDone && (
                  <span className="text-xs text-emerald-600">완료</span>
                )}
              </div>
            </div>

            {/* 날짜 입력 */}
            <div className="flex-shrink-0">
              <input
                type="date"
                value={date ?? ""}
                onChange={(e) => setDate(field, e.target.value)}
                className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDone   ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                  isActive ? "border-blue-300 bg-white text-zinc-700"            :
                             "border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}
              />
            </div>
          </div>
        );
      })}

      {/* 현재 상태 요약 */}
      {lastDoneIdx >= 0 && (
        <div className="mt-3 text-xs text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2">
          {activeIdx < STAGE_DEFINITIONS.length ? (
            <>
              <span className="font-semibold text-blue-700">{STAGE_DEFINITIONS[activeIdx].label}</span>
              {" 단계 도전 중"}
              {elapsed != null && (
                <> · <span className="font-semibold">{fElapsed(elapsed)}</span> 진행 중 ({lastDoneDate?.replace(/-/g, ".")} 이후)</>
              )}
            </>
          ) : (
            <span className="font-semibold text-emerald-700">사업 완료</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function ReportUpgradeClient() {
  const [dbZones, setDbZones]     = useState<ZoneListItem[]>([]);
  const [input, setInput]         = useState<UserInput>(DEFAULT_USER_INPUT);
  const [pyungUnit, setPyungUnit] = useState<"pyung" | "sqm">("pyung");
  const [sqmRaw, setSqmRaw]       = useState("");

  // 1단계 상태
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error]     = useState<string | null>(null);
  const [step1, setStep1]               = useState<Step1Data | null>(null);

  useEffect(() => {
    fetch("/api/admin/zones-list")
      .then((r) => r.json())
      .then((d) => { if (d.zones) setDbZones(d.zones); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (dbZones.length === 0 || input.zoneId !== "") return;
    const target = dbZones.find(
      (z) =>
        z.zone_name?.includes("성일") ||
        z.zone_name?.includes("권선2") ||
        z.zone_name?.includes("권선 2"),
    );
    if (target) {
      setInput((prev) => ({
        ...prev,
        zoneId: target.zone_id,
        projectType: target.project_type === "reconstruction" ? "reconstruction" : "redevelopment",
        propertyType: target.project_type === "reconstruction" ? "apartment" : "villa",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbZones]);

  function set<K extends keyof UserInput>(key: K, value: UserInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function handleZoneChange(zoneId: string) {
    const zone = dbZones.find((z) => z.zone_id === zoneId);
    const recon = zone?.project_type === "reconstruction";
    setInput((prev) => ({
      ...prev,
      zoneId,
      projectType: recon ? "reconstruction" : "redevelopment",
      propertyType: recon ? "apartment" : "villa",
    }));
    setStep1(null);
    setStep1Error(null);
  }

  const handleMapSelect = useCallback((zoneId: string, projectType: string) => {
    const recon = projectType === "reconstruction";
    setInput((prev) => ({
      ...prev,
      zoneId,
      projectType: recon ? "reconstruction" : "redevelopment",
      propertyType: recon ? "apartment" : "villa",
    }));
    setStep1(null);
    setStep1Error(null);
    document.getElementById("user-input-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function handleStep1() {
    if (!input.zoneId) return;
    setStep1Loading(true);
    setStep1Error(null);
    const { data, error } = await fetchStep1Data(input.zoneId);
    if (error || !data) setStep1Error(error ?? "알 수 없는 오류");
    else setStep1(data);
    setStep1Loading(false);
    setTimeout(() => {
      document.getElementById("step1-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  // step1 편집 헬퍼
  function setS1<K extends keyof Step1Data>(key: K, value: Step1Data[K]) {
    setStep1((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function setExisting(cat: keyof UnitsByCategory, v: number | null) {
    setStep1((prev) => prev ? { ...prev, existingUnits: { ...prev.existingUnits, [cat]: v } } : prev);
  }

  function setNew(cat: keyof UnitsByCategory, v: number | null) {
    setStep1((prev) => prev ? { ...prev, newUnits: { ...prev.newUnits, [cat]: v } } : prev);
  }

  const selectedZone = dbZones.find((z) => z.zone_id === input.zoneId);
  const recons = dbZones.filter((z) => z.project_type === "reconstruction");
  const redevs = dbZones.filter((z) => z.project_type === "redevelopment");
  const netCash = input.purchasePrice - input.purchaseLoanAmount - input.currentDeposit;
  const ltv = input.purchasePrice > 0
    ? `${((input.purchaseLoanAmount / input.purchasePrice) * 100).toFixed(0)}%`
    : "—";

  // 평형 카테고리 컬럼 정의
  const CATS: { key: keyof UnitsByCategory; label: string }[] = [
    { key: "u40",    label: "40㎡미만" },
    { key: "c40_60", label: "40~60㎡" },
    { key: "c60_85", label: "60~85㎡" },
    { key: "c85_135",label: "85~135㎡"},
    { key: "o135",   label: "135㎡초과"},
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">

      {/* 헤더 */}
      <div>
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-widest">내부 테스트 전용</span>
        <h1 className="text-3xl font-bold text-zinc-900 mt-1">재건축 분석 리포트</h1>
        <p className="text-sm text-zinc-400 mt-1">구역 선택 후 투자 정보를 입력하세요.</p>
      </div>

      {/* 지도 */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-bold text-zinc-900">관심 구역 선택</h2>
          <p className="text-xs text-zinc-400 mt-0.5">지도에서 구역을 클릭하면 아래 폼에 자동 반영됩니다.</p>
        </div>
        <ZoneMap onSelect={handleMapSelect} selectedZoneId={input.zoneId} />
        {selectedZone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">선택된 구역:</span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
              {selectedZone.zone_name ?? selectedZone.zone_id}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              input.projectType === "reconstruction" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
            }`}>
              {input.projectType === "reconstruction" ? "재건축" : "재개발"}
            </span>
          </div>
        )}
      </div>

      {/* 사용자 입력 폼 */}
      <div id="user-input-form" className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-zinc-900">사용자 입력값</h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            input.projectType === "reconstruction" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
          }`}>
            {input.projectType === "reconstruction" ? "🏢 재건축" : "🏘️ 재개발"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 구역 선택 */}
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="text-sm font-medium text-zinc-700">관심 구역</label>
            <select
              value={input.zoneId}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">구역을 선택하세요</option>
              {recons.length > 0 && (
                <optgroup label="✅ 재건축">
                  {recons.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>{z.zone_name ?? z.zone_id}</option>
                  ))}
                </optgroup>
              )}
              {redevs.length > 0 && (
                <optgroup label="🔒 재개발 (준비중)">
                  {redevs.map((z) => (
                    <option key={z.zone_id} value={z.zone_id} disabled>
                      {z.zone_name ?? z.zone_id} (준비중)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-zinc-400">재건축 {recons.length}개 · 재개발 {redevs.length}개</p>
          </div>

          {/* 물건 유형 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">물건 유형</label>
            <select
              value={input.propertyType}
              disabled={input.projectType !== "reconstruction"}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              {input.projectType === "reconstruction"
                ? <option value="apartment">아파트</option>
                : (
                  <>
                    <option value="villa">빌라 (준비중)</option>
                    <option value="house">단독주택 (준비중)</option>
                  </>
                )
              }
            </select>
          </div>

          <NumInput label="매수 희망가 (원)" value={input.purchasePrice} onChange={(v) => set("purchasePrice", v)} placeholder="예: 300000000" showWon />
          <NumInput label="매수 시 대출금 (원)" value={input.purchaseLoanAmount} onChange={(v) => set("purchaseLoanAmount", v)} placeholder="예: 200000000" note="보유기간 이자 계산에 사용" showWon />
          <NumInput label="현재 전/월세 보증금 (원)" value={input.currentDeposit} onChange={(v) => set("currentDeposit", v)} placeholder="예: 0" showWon />

          {/* 희망 평형 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">희망 조합원 분양 평형</label>
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 text-xs">
                <button type="button" onClick={() => setPyungUnit("pyung")}
                  className={`px-2.5 py-1 font-medium transition-colors ${pyungUnit === "pyung" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
                  평형
                </button>
                <button type="button" onClick={() => setPyungUnit("sqm")}
                  className={`px-2.5 py-1 font-medium transition-colors ${pyungUnit === "sqm" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
                  ㎡
                </button>
              </div>
            </div>
            {pyungUnit === "pyung" ? (
              <input type="number" value={input.desiredPyung || ""} onChange={(e) => set("desiredPyung", Number(e.target.value))}
                placeholder="예: 25, 34"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <input type="number" value={sqmRaw} onChange={(e) => {
                setSqmRaw(e.target.value);
                const sqm = parseFloat(e.target.value);
                if (sqm > 0) set("desiredPyung", Math.round((sqm / 3.3058) * 10) / 10);
              }}
                placeholder="예: 84.91"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {input.desiredPyung > 0 && (
              <p className="text-xs font-semibold text-blue-600">
                {pyungUnit === "sqm"
                  ? `≈ ${input.desiredPyung}평 (${(input.desiredPyung * 3.3058).toFixed(1)}㎡)`
                  : `≈ ${(input.desiredPyung * 3.3058).toFixed(1)}㎡`}
              </p>
            )}
          </div>

        </div>

        {/* 실투자금 미리보기 */}
        <div className="bg-blue-50 rounded-xl p-4 text-sm flex flex-wrap gap-x-8 gap-y-1">
          <span className="text-zinc-500">
            실투자 현금 (대출·보증금 제외): <strong className="text-zinc-900 ml-1">{fWon(netCash)}</strong>
          </span>
          <span className="text-zinc-500">
            LTV: <strong className="text-zinc-900 ml-1">{ltv}</strong>
          </span>
        </div>

        {input.projectType !== "reconstruction" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium">
            🔒 재개발 분석은 준비 중입니다. 재건축 구역을 선택해주세요.
          </div>
        )}

        {/* 1단계 실행 버튼 */}
        <button
          type="button"
          onClick={handleStep1}
          disabled={step1Loading || !input.zoneId || input.projectType !== "reconstruction"}
          className="rounded-xl bg-blue-600 text-white font-bold py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          {step1Loading ? "불러오는 중..." : "1단계 실행 →"}
        </button>

        {step1Error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            오류: {step1Error}
          </div>
        )}
      </div>

      {/* ── 1단계 결과 ──────────────────────────────────────────────────────── */}
      {step1 && (
        <div id="step1-section" className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 flex flex-col gap-8">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">1단계</span>
            <h2 className="font-bold text-zinc-900 mt-0.5">구역 기본 정보 검토</h2>
            <p className="text-xs text-zinc-400 mt-0.5">DB·API에서 자동 조회한 값입니다. 수정이 필요한 항목은 직접 편집하세요.</p>
          </div>

          {/* ① 공시가격 + 대지지분 */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">① 공시가격 · 대지지분</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* 공동주택 공시가격 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">
                  공동주택 공시가격 (원)
                  <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">브이월드 자동 조회</span>
                </label>
                <input
                  type="number"
                  value={step1.officialPrice ?? ""}
                  onChange={(e) => setS1("officialPrice", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="자동 조회 실패 시 직접 입력"
                  className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {step1.officialPrice != null && step1.officialPrice > 0 && (
                  <p className="text-xs font-semibold text-blue-600">
                    {(step1.officialPrice / 100_000_000).toFixed(2)}억원
                  </p>
                )}
                {step1.officialPriceApiError && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                    ⚠ API 조회 실패: {step1.officialPriceApiError}
                  </p>
                )}
              </div>

              {/* 대지지분 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">
                  대지지분 (㎡)
                  <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">건축물대장 자동 계산</span>
                </label>
                <input
                  type="number"
                  value={step1.landShareSqm ?? ""}
                  onChange={(e) => setS1("landShareSqm", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder={step1.landSharePlatArea == null ? "건축물대장 미조회" : "—"}
                  className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {step1.landShareSqm != null && (
                  <p className="text-xs font-semibold text-blue-600">
                    {step1.landShareSqm}㎡ ({(step1.landShareSqm / 3.3058).toFixed(2)}평)
                  </p>
                )}
                {/* 계산 과정 */}
                {step1.landSharePlatArea != null && step1.landShareTotalUnits != null && (
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    계산: {step1.landSharePlatArea.toLocaleString()}㎡ ÷ {step1.landShareTotalUnits}세대
                    = <span className="font-medium text-zinc-600">{step1.landShareSqm?.toFixed(2)}㎡</span>
                    <br />
                    (대지면적 ÷ 기존세대수, 전용 {step1.landShareUnitSqm}㎡ 균등 가정)
                  </p>
                )}
                {step1.landSharePlatArea == null && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                    ⚠ 건축물대장 미조회 — 좌표 또는 API 키 확인 필요
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ② 코드 정보 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">② 코드 정보</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="시군코드 (5자리)"
                value={step1.lawdCd ?? ""}
                onChange={(v) => setS1("lawdCd", v || null)}
                placeholder="예: 41113"
                mono
              />
              <TextInput
                label="법정동코드 (10자리)"
                value={step1.bjdCode ?? ""}
                onChange={(v) => setS1("bjdCode", v || null)}
                placeholder="예: 4111300100"
                mono
              />
            </div>
          </section>

          {/* ③ 평형별 세대수 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">③ 평형별 세대수</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-zinc-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 w-24">구분</th>
                    {CATS.map((c) => (
                      <th key={c.key} className="text-center px-2 py-2 text-xs font-semibold text-zinc-500">{c.label}</th>
                    ))}
                    <th className="text-center px-2 py-2 text-xs font-semibold text-zinc-500">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 재건축 전 */}
                  <tr className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-xs font-medium text-zinc-500">재건축 전</td>
                    {CATS.map((c) => (
                      <td key={c.key} className="px-2 py-1">
                        <input
                          type="number"
                          value={step1.existingUnits[c.key] ?? ""}
                          onChange={(e) => setExisting(c.key, e.target.value === "" ? null : Number(e.target.value))}
                          className="border border-zinc-300 rounded px-2 py-1 text-sm text-center w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center text-sm font-semibold text-zinc-700">
                      {CATS.reduce((s, c) => s + (step1.existingUnits[c.key] ?? 0), 0) || "—"}
                    </td>
                  </tr>
                  {/* 재건축 후 */}
                  <tr className="border-t border-zinc-100 bg-blue-50/30">
                    <td className="px-3 py-2 text-xs font-medium text-zinc-500">재건축 후</td>
                    {CATS.map((c) => (
                      <td key={c.key} className="px-2 py-1">
                        <input
                          type="number"
                          value={step1.newUnits[c.key] ?? ""}
                          onChange={(e) => setNew(c.key, e.target.value === "" ? null : Number(e.target.value))}
                          className="border border-zinc-300 rounded px-2 py-1 text-sm text-center w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center text-sm font-semibold text-blue-700">
                      {CATS.reduce((s, c) => s + (step1.newUnits[c.key] ?? 0), 0) || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ④ 용적률 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">④ 용적률</h3>
            <div className="grid grid-cols-2 gap-4">
              <NullableNumInput
                label="기존 용적률 (%)"
                value={step1.farExisting}
                onChange={(v) => setS1("farExisting", v)}
                placeholder="예: 180"
                suffix="%"
              />
              <NullableNumInput
                label="재건축 후 용적률 (%)"
                value={step1.farNew}
                onChange={(v) => setS1("farNew", v)}
                placeholder="미확정 시 빈칸"
                suffix="%"
              />
            </div>
          </section>

          {/* ⑤ 구역 크기 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">⑤ 구역 크기</h3>
            <div className="grid grid-cols-2 gap-4">
              <NullableNumInput
                label="구역면적 (㎡, DB)"
                value={step1.zoneSqm}
                onChange={(v) => setS1("zoneSqm", v)}
                suffix="㎡"
              />
              <NullableNumInput
                label="건축물대장 연면적 (㎡)"
                value={step1.buildingFloorArea}
                onChange={(v) => setS1("buildingFloorArea", v)}
                placeholder={step1.buildingFloorArea == null ? "API 미조회" : undefined}
                suffix="㎡"
              />
            </div>
            {step1.buildingFloorArea == null && (
              <p className="text-xs text-zinc-400">건축물대장 연면적: 좌표 또는 API 키 없어 미조회</p>
            )}
          </section>

          {/* ⑥ 정비 단계 타임라인 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">⑥ 정비 단계 타임라인</h3>
            <StageTimeline step1={step1} setStep1={setStep1} />
          </section>

          {/* ⑦ 공사비 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">⑦ 공사비</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NullableNumInput
                label="평당 공사비 (원/평)"
                value={step1.constructionCostPerPyung}
                onChange={(v) => setS1("constructionCostPerPyung", v)}
                suffix="원/평"
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">급지</label>
                <input
                  type="text"
                  value={step1.constructionTier ?? ""}
                  onChange={(e) => setS1("constructionTier", e.target.value || null)}
                  className="border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">KOSIS 건설공사비지수</label>
                <input
                  type="number"
                  value={step1.kosisIndex ?? ""}
                  onChange={(e) => setS1("kosisIndex", e.target.value === "" ? null : Number(e.target.value))}
                  className="border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-zinc-400">기준: 2020=100</p>
              </div>
            </div>
            {step1.constructionCostPerPyung != null && (
              <p className="text-xs text-zinc-400">
                추정 평당 공사비: <span className="font-semibold text-zinc-700">{step1.constructionCostPerPyung.toLocaleString()}원</span>
                {step1.kosisIndex != null && ` (KOSIS ${step1.kosisIndex} 지수 반영)`}
              </p>
            )}
          </section>

        </div>
      )}

    </div>
  );
}

"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { UserInput, DEFAULT_USER_INPUT } from "./types";

// Kakao 지도 SDK는 브라우저 전용 — SSR 비활성화
const ZoneMap = dynamic(() => import("@/components/map/ZoneMap"), { ssr: false });

// ─── 구역 목록 아이템 ──────────────────────────────────────────────────────────
interface ZoneListItem {
  zone_id: string;
  zone_name: string | null;
  project_type: string;
  project_stage: string;
}

// ─── 숫자 포맷 ────────────────────────────────────────────────────────────────
function fWon(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억원`;
  if (abs >= 10_000_000)  return `${sign}${(abs / 10_000_000).toFixed(1)}천만원`;
  if (abs >= 1_000_000)   return `${sign}${(abs / 1_000_000).toFixed(0)}백만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

// ─── 숫자 입력 공통 컴포넌트 ──────────────────────────────────────────────────
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

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function ReportUpgradeClient() {
  const [dbZones, setDbZones]   = useState<ZoneListItem[]>([]);
  const [input, setInput]       = useState<UserInput>(DEFAULT_USER_INPUT);
  const [pyungUnit, setPyungUnit] = useState<"pyung" | "sqm">("pyung");
  const [sqmRaw, setSqmRaw]     = useState("");

  // 구역 목록 로드
  useEffect(() => {
    fetch("/api/admin/zones-list")
      .then((r) => r.json())
      .then((d) => { if (d.zones) setDbZones(d.zones); })
      .catch(() => {});
  }, []);

  // 구역 목록 로드 후 성일아파트 자동 선택
  useEffect(() => {
    if (dbZones.length === 0 || input.zoneId !== "") return;
    const target = dbZones.find((z) =>
      z.zone_name?.includes("성일") ||
      z.zone_name?.includes("권선2") ||
      z.zone_name?.includes("권선 2")
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
  }

  const handleMapSelect = useCallback(
    (zoneId: string, projectType: string) => {
      const recon = projectType === "reconstruction";
      setInput((prev) => ({
        ...prev,
        zoneId,
        projectType: recon ? "reconstruction" : "redevelopment",
        propertyType: recon ? "apartment" : "villa",
      }));
      document.getElementById("user-input-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

  const selectedZone = dbZones.find((z) => z.zone_id === input.zoneId);
  const recons = dbZones.filter((z) => z.project_type === "reconstruction");
  const redevs = dbZones.filter((z) => z.project_type === "redevelopment");

  const netCash = input.purchasePrice - input.purchaseLoanAmount - input.currentDeposit;
  const ltv = input.purchasePrice > 0
    ? ((input.purchaseLoanAmount / input.purchasePrice) * 100).toFixed(0)
    : "—";

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
          <p className="text-xs text-zinc-400 mt-0.5">
            지도에서 구역을 클릭하면 아래 폼에 자동 반영됩니다.
          </p>
        </div>
        <ZoneMap onSelect={handleMapSelect} selectedZoneId={input.zoneId} />
        {selectedZone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">선택된 구역:</span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
              {selectedZone.zone_name ?? selectedZone.zone_id}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              input.projectType === "reconstruction"
                ? "bg-blue-100 text-blue-600"
                : "bg-green-100 text-green-600"
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
            input.projectType === "reconstruction"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}>
            {input.projectType === "reconstruction" ? "🏢 재건축" : "🏘️ 재개발"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* 구역 선택 드롭다운 */}
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
                    <option key={z.zone_id} value={z.zone_id}>
                      {z.zone_name ?? z.zone_id}
                    </option>
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
            <p className="text-xs text-zinc-400">
              재건축 {recons.length}개 · 재개발 {redevs.length}개
            </p>
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

          {/* 매수 희망가 */}
          <NumInput
            label="매수 희망가 (원)"
            value={input.purchasePrice}
            onChange={(v) => set("purchasePrice", v)}
            placeholder="예: 300000000"
            showWon
          />

          {/* 대출금 */}
          <NumInput
            label="매수 시 대출금 (원)"
            value={input.purchaseLoanAmount}
            onChange={(v) => set("purchaseLoanAmount", v)}
            placeholder="예: 200000000"
            note="보유기간 이자 계산에 사용"
            showWon
          />

          {/* 전/월세 보증금 */}
          <NumInput
            label="현재 전/월세 보증금 (원)"
            value={input.currentDeposit}
            onChange={(v) => set("currentDeposit", v)}
            placeholder="예: 0 (거주 중이면 0)"
            showWon
          />

          {/* 희망 조합원 분양 평형 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">희망 조합원 분양 평형</label>
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 text-xs">
                <button
                  type="button"
                  onClick={() => setPyungUnit("pyung")}
                  className={`px-2.5 py-1 font-medium transition-colors ${pyungUnit === "pyung" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
                >평형</button>
                <button
                  type="button"
                  onClick={() => setPyungUnit("sqm")}
                  className={`px-2.5 py-1 font-medium transition-colors ${pyungUnit === "sqm" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
                >㎡</button>
              </div>
            </div>
            {pyungUnit === "pyung" ? (
              <input
                type="number"
                value={input.desiredPyung || ""}
                onChange={(e) => set("desiredPyung", Number(e.target.value))}
                placeholder="예: 25, 34"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type="number"
                value={sqmRaw}
                onChange={(e) => {
                  setSqmRaw(e.target.value);
                  const sqm = parseFloat(e.target.value);
                  if (sqm > 0) set("desiredPyung", Math.round((sqm / 3.3058) * 10) / 10);
                }}
                placeholder="예: 84.91"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {input.desiredPyung > 0 && (
              <p className="text-xs font-semibold text-blue-600">
                {pyungUnit === "sqm"
                  ? `≈ ${input.desiredPyung}평 (${(input.desiredPyung * 3.3058).toFixed(1)}㎡)`
                  : `≈ ${(input.desiredPyung * 3.3058).toFixed(1)}㎡`}
              </p>
            )}
          </div>

          {/* 공동주택 공시가격 */}
          <NumInput
            label="공동주택 공시가격 (원)"
            value={input.officialValuation}
            onChange={(v) => set("officialValuation", v)}
            placeholder="미입력 시 자동 조회"
            note="입력 시 우선 적용"
            showWon
          />

          {/* 대지지분 — 재건축 전용 */}
          {input.projectType === "reconstruction" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">
                대지지분 (㎡)
                <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  재건축 핵심 지표
                </span>
              </label>
              <input
                type="number"
                value={input.landShareSqm || ""}
                onChange={(e) => set("landShareSqm", parseFloat(e.target.value) || 0)}
                placeholder="예: 16.5"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-400">
                등기부등본 → 표제부 → 「대지권의 표시」에서 확인
              </p>
            </div>
          )}
        </div>

        {/* 실투자금 미리보기 */}
        <div className="bg-blue-50 rounded-xl p-4 text-sm flex flex-wrap gap-x-8 gap-y-1">
          <span className="text-zinc-500">
            실투자 현금 (대출·보증금 제외):
            <strong className="text-zinc-900 ml-2">{fWon(netCash)}</strong>
          </span>
          <span className="text-zinc-500">
            LTV: <strong className="text-zinc-900 ml-2">{ltv}{typeof ltv === "string" && ltv !== "—" ? "%" : ""}</strong>
          </span>
        </div>

        {input.projectType !== "reconstruction" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium">
            🔒 재개발 분석은 준비 중입니다. 재건축 구역을 선택해주세요.
          </div>
        )}

        {/* 분석 실행 버튼 — 연결은 나중에 */}
        <button
          type="button"
          disabled={!input.zoneId || input.projectType !== "reconstruction"}
          className="rounded-xl bg-blue-600 text-white font-bold py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          분석 실행 →
        </button>
      </div>

    </div>
  );
}

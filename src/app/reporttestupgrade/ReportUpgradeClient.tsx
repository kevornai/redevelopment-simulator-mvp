"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  UserInput, DEFAULT_USER_INPUT, Step1Data, Step2Data, UnitsByCategory,
  STAGE_DEFINITIONS, StageDateField,
} from "./types";
import { fetchStep1Data, fetchStep2Data } from "./actions";

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

// ─── 포맷 헬퍼 ───────────────────────────────────────────────────────────────
function fmt억(v: number | null): string {
  if (v == null) return "—";
  return `${(v / 1e8).toFixed(1)}억`;
}
function fmt만(v: number | null): string {
  if (v == null) return "—";
  return `${(v / 1e4).toFixed(0)}만원`;
}
function fPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

// ─── 2단계 섹션 ──────────────────────────────────────────────────────────────

function Step2Row({
  label, value, onChange, note, suffix, bold,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  note?: React.ReactNode;
  suffix?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className={`text-sm ${bold ? "font-semibold text-zinc-800" : "font-medium text-zinc-700"} flex-1`}>{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className={`border rounded px-2 py-1 text-sm text-right w-40 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${bold ? "border-emerald-300 bg-emerald-50 font-semibold" : "border-zinc-300"}`}
          />
          {suffix && <span className="text-xs text-zinc-400 w-8">{suffix}</span>}
        </div>
      </div>
      {note && <p className="text-xs text-zinc-400 pl-1 leading-relaxed">{note}</p>}
    </div>
  );
}

function Step2Section({
  step2, setS2,
}: {
  step2: Step2Data;
  setS2: <K extends keyof Step2Data>(key: K, value: Step2Data[K]) => void;
}) {
  const [showProjPredictor, setShowProjPredictor] = React.useState(false);
  const [projMonths, setProjMonths]               = React.useState(24);
  const [projAnnualRate, setProjAnnualRate]        = React.useState(3.0);

  const projPBase = step2.pBase && projMonths > 0
    ? Math.round(step2.pBase * Math.pow(1 + projAnnualRate / 100 / 12, projMonths) / 10_000) * 10_000
    : null;
  const projMemberPrice = projPBase && step2.memberSaleDiscountRate
    ? Math.round(projPBase * step2.memberSaleDiscountRate)
    : null;

  return (
    <div className="flex flex-col gap-7">

      {/* ① 종전자산평가액 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">① 종전자산평가액</h3>
        <Step2Row
          label="종전자산평가액"
          value={step2.totalAppraisalValue}
          onChange={(v) => setS2("totalAppraisalValue", v)}
          bold
          suffix="원"
          note={
            <>
              {fmt억(step2.totalAppraisalValue)}
              <br />
              계산: {step2.appraisalUnits.toLocaleString()}세대 × {fmt만(step2.appraisalOfficialPrice)} × 1.4
              {" = "}{fmt억(step2.totalAppraisalValue)}
            </>
          }
        />
      </section>

      {/* ② 일반분양수익 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">② 일반분양수익</h3>
        {step2.pBaseApiError && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">⚠ MOLIT API: {step2.pBaseApiError}</p>
        )}

        {/* p_base 행 + 예측 버튼 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-zinc-700 flex-1">인근 신축 평당 분양가 (p_base, 현재)</label>
            <button
              type="button"
              onClick={() => setShowProjPredictor(v => !v)}
              className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap transition-colors"
            >
              {showProjPredictor ? "닫기" : "분양 시점 분양가 투영"}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={step2.pBase ?? ""}
              onChange={(e) => setS2("pBase", e.target.value === "" ? null : Number(e.target.value))}
              className="border border-zinc-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-400 whitespace-nowrap w-8">원/평</span>
          </div>
          <p className="text-xs text-zinc-400">MOLIT 실거래가 기준 · 인근 신축(최근 24개월) 중앙값</p>
        </div>

        {/* 분양 시점 투영 */}
        {showProjPredictor && step2.pBase != null && (
          <div className="bg-blue-50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-700">분양 시점 분양가 투영</span>
              <span className="text-xs text-zinc-400">(중립, 복리 상승)</span>
            </div>

            {/* 파라미터 입력 */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-600 whitespace-nowrap">분양까지 남은 개월</label>
                <input
                  type="number"
                  value={projMonths}
                  onChange={(e) => setProjMonths(Math.max(1, Number(e.target.value)))}
                  className="border border-blue-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-zinc-400">개월</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-600 whitespace-nowrap">연 상승률</label>
                <input
                  type="number"
                  step="0.1"
                  value={projAnnualRate}
                  onChange={(e) => setProjAnnualRate(Number(e.target.value))}
                  className="border border-blue-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-zinc-400">%/년</span>
              </div>
            </div>

            {/* 일반분양가 투영 결과 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600">분양 시점 예상 평당 일반분양가</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={projPBase ?? ""}
                  readOnly
                  className="border border-blue-200 bg-white rounded px-2 py-1.5 text-sm font-semibold text-blue-800 w-44"
                />
                <span className="text-xs text-zinc-400">원/평</span>
                {projPBase && step2.pBase && (
                  <span className="text-xs text-blue-600">
                    +{(((projPBase - step2.pBase) / step2.pBase) * 100).toFixed(1)}%
                    ({fmt만(projPBase - step2.pBase)}↑)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                계산: {fmt만(step2.pBase)}/평 × (1 + {(projAnnualRate/12).toFixed(3)}%/월)
                <sup>{projMonths}</sup> = <span className="font-semibold">{fmt만(projPBase)}/평</span>
                <br />
                <span className="text-zinc-400">월 상승률 = 연 {projAnnualRate}% ÷ 12 = {(projAnnualRate/12).toFixed(3)}%/월</span>
              </p>
              <button
                type="button"
                onClick={() => setS2("pBase", projPBase)}
                className="self-start text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                이 값으로 p_base 적용
              </button>
            </div>

            {/* 조합원분양가 투영 결과 */}
            {step2.memberSaleDiscountRate != null && projMemberPrice != null && (
              <div className="flex flex-col gap-1.5 border-t border-blue-100 pt-3">
                <label className="text-xs font-medium text-zinc-600">분양 시점 예상 평당 조합원 분양가</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={projMemberPrice}
                    readOnly
                    className="border border-blue-200 bg-white rounded px-2 py-1.5 text-sm font-semibold text-blue-800 w-44"
                  />
                  <span className="text-xs text-zinc-400">원/평</span>
                  {step2.memberSalePricePerPyung && (
                    <span className="text-xs text-blue-600">
                      +{(((projMemberPrice - step2.memberSalePricePerPyung) / step2.memberSalePricePerPyung) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  계산: {fmt만(projPBase)}/평 × {(step2.memberSaleDiscountRate * 100).toFixed(0)}%(지역 할인율)
                  = <span className="font-semibold">{fmt만(projMemberPrice)}/평</span>
                </p>
                <button
                  type="button"
                  onClick={() => setS2("memberSalePricePerPyung", projMemberPrice)}
                  className="self-start text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  이 값으로 조합원 분양가 적용
                </button>
              </div>
            )}
          </div>
        )}
        <Step2Row
          label="일반분양 면적"
          value={step2.generalSaleAreaPyung}
          onChange={(v) => setS2("generalSaleAreaPyung", v)}
          suffix="평"
          note={
            step2.generalSaleAreaSqm != null
              ? `계산: 신축총분양면적 × (일반분양세대 / 신축전체세대) = ${step2.generalSaleAreaSqm.toLocaleString()}㎡ = ${step2.generalSaleAreaPyung?.toFixed(1)}평`
              : "신축/기존 세대수 데이터 필요"
          }
        />
        <Step2Row
          label="일반분양수익"
          value={step2.generalRevenue}
          onChange={(v) => setS2("generalRevenue", v)}
          bold
          suffix="원"
          note={
            step2.pBase && step2.generalSaleAreaPyung
              ? `계산: ${fmt만(step2.pBase)}/평 × ${step2.generalSaleAreaPyung.toFixed(1)}평 = ${fmt억(step2.generalRevenue)}`
              : "p_base 또는 일반분양면적 없음"
          }
        />
      </section>

      {/* ③ 조합원분양수익 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">③ 조합원분양수익</h3>
        <Step2Row
          label="평당 조합원 분양가"
          value={step2.memberSalePricePerPyung}
          onChange={(v) => setS2("memberSalePricePerPyung", v)}
          suffix="원/평"
          note={
            step2.memberSaleDiscountRate != null && step2.pBase
              ? `계산: p_base ${fmt만(step2.pBase)}/평 × ${(step2.memberSaleDiscountRate * 100).toFixed(0)}%(중립 지역할인율) = ${fmt만(step2.memberSalePricePerPyung)}/평`
              : "확정값 또는 수동입력 적용"
          }
        />
        <Step2Row
          label="조합원분양 면적"
          value={step2.memberSaleAreaPyung}
          onChange={(v) => setS2("memberSaleAreaPyung", v)}
          suffix="평"
          note={
            step2.memberSaleAreaSqm != null
              ? `계산: 신축총분양면적 × (조합원세대 / 신축전체세대) = ${step2.memberSaleAreaSqm.toLocaleString()}㎡ = ${step2.memberSaleAreaPyung?.toFixed(1)}평`
              : "기존 세대수 데이터 필요"
          }
        />
        <Step2Row
          label="조합원분양수익"
          value={step2.memberRevenue}
          onChange={(v) => setS2("memberRevenue", v)}
          bold
          suffix="원"
          note={
            step2.memberSalePricePerPyung && step2.memberSaleAreaPyung
              ? `계산: ${fmt만(step2.memberSalePricePerPyung)}/평 × ${step2.memberSaleAreaPyung.toFixed(1)}평 = ${fmt억(step2.memberRevenue)}`
              : ""
          }
        />
      </section>

      {/* ④ 총사업비 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">④ 총사업비</h3>
        {/* 신축연면적 계산 과정 */}
        <div className="bg-zinc-50 rounded-lg px-3 py-2 text-xs text-zinc-500 leading-relaxed">
          <p className="font-medium text-zinc-700 mb-1">신축연면적 계산 과정</p>
          {step2.platAreaUsed
            ? <p>역산 대지면적 = platArea {step2.platAreaUsed.toLocaleString()}㎡ (건축물대장)</p>
            : step2.buildingFloorAreaUsed && step2.farExistingUsed
            ? <p>역산 대지면적 = 기존연면적 {step2.buildingFloorAreaUsed.toLocaleString()}㎡ ÷ (기존용적률 {step2.farExistingUsed}% / 100) = {step2.derivedSiteArea?.toLocaleString()}㎡</p>
            : <p>역산 대지면적 = 구역면적 {step2.derivedSiteArea?.toLocaleString()}㎡</p>
          }
          {step2.farNewUsed && step2.derivedSiteArea && (
            <p>신축연면적 = {step2.derivedSiteArea.toLocaleString()}㎡ × {step2.farNewUsed}% = {step2.newFloorAreaSqm?.toLocaleString()}㎡ = {step2.newFloorAreaPyung?.toFixed(1)}평</p>
          )}
        </div>
        <Step2Row
          label="분양연면적 (지상, 용적률 기준)"
          value={step2.newFloorAreaPyung}
          onChange={(v) => setS2("newFloorAreaPyung", v)}
          suffix="평"
          note="수익 계산 기준"
        />
        <Step2Row
          label={`공사연면적 (×${step2.constructionAreaMultiplier}, 지하+커뮤니티 포함)`}
          value={step2.constructionFloorAreaPyung}
          onChange={(v) => setS2("constructionFloorAreaPyung", v)}
          suffix="평"
          note={
            step2.newFloorAreaPyung
              ? `계산: 분양연면적 ${step2.newFloorAreaPyung.toFixed(1)}평 × ${step2.constructionAreaMultiplier} = ${step2.constructionFloorAreaPyung?.toFixed(1)}평`
              : "공사비 계산 기준"
          }
        />
        <Step2Row
          label="평당 공사비 (C₀)"
          value={step2.constructionCostPerPyung}
          onChange={(v) => setS2("constructionCostPerPyung", v)}
          suffix="원/평"
          note="1단계 KOSIS 보정값 (중립 시나리오 기준)"
        />
        <Step2Row
          label="순수공사비"
          value={step2.pureCost}
          onChange={(v) => setS2("pureCost", v)}
          suffix="원"
          note={
            step2.constructionCostPerPyung && step2.constructionFloorAreaPyung
              ? `계산: ${fmt만(step2.constructionCostPerPyung)}/평 × ${step2.constructionFloorAreaPyung.toFixed(1)}평(공사연면적) = ${fmt억(step2.pureCost)}`
              : ""
          }
        />
        <Step2Row
          label={`기타사업비 (${(step2.otherCostRate * 100).toFixed(0)}%)`}
          value={step2.otherCost}
          onChange={(v) => setS2("otherCost", v)}
          suffix="원"
          note={`계산: 순수공사비 × ${(step2.otherCostRate * 100).toFixed(0)}% = ${fmt억(step2.otherCost)}`}
        />
        <Step2Row
          label="금융비용"
          value={step2.financialCost}
          onChange={(v) => setS2("financialCost", v)}
          suffix="원"
          note={`계산: 순수공사비 × PF${(step2.pfLoanRatio * 100).toFixed(0)}% × (${(step2.pfAnnualRate * 100).toFixed(1)}%/12) × ${step2.projectMonths}개월 = ${fmt억(step2.financialCost)}`}
        />
        <Step2Row
          label="총사업비"
          value={step2.totalCost}
          onChange={(v) => setS2("totalCost", v)}
          bold
          suffix="원"
          note={`순수공사비 ${fmt억(step2.pureCost)} + 기타 ${fmt억(step2.otherCost)} + 금융 ${fmt억(step2.financialCost)} = ${fmt억(step2.totalCost)}`}
        />
      </section>

      {/* ⑤ 비례율 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">⑤ 비례율</h3>
        <Step2Row
          label="비례율"
          value={step2.proportionalRate}
          onChange={(v) => setS2("proportionalRate", v)}
          bold
          suffix="%"
          note={
            <>
              계산: (총분양수익 - 총사업비) ÷ 종전자산평가액
              <br />
              = ({fmt억(step2.totalRevenue != null ? step2.totalRevenue : null)} - {fmt억(step2.totalCost)}) ÷ {fmt억(step2.totalAppraisalValue)} = {fPct(step2.proportionalRate)}
            </>
          }
        />
      </section>

      {/* ⑥ 분담금 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">⑥ 중립 분담금</h3>
        <Step2Row
          label="개인 감정평가액"
          value={step2.personalAppraisalValue}
          onChange={(v) => setS2("personalAppraisalValue", v)}
          suffix="원"
          note={`계산: 공시가 ${fmt만(step2.appraisalOfficialPrice)} × 1.4 = ${fmt억(step2.personalAppraisalValue)}`}
        />
        <Step2Row
          label="권리가액"
          value={step2.rightsValue}
          onChange={(v) => setS2("rightsValue", v)}
          suffix="원"
          note={`계산: 감정평가액 ${fmt억(step2.personalAppraisalValue)} × 비례율 ${fPct(step2.proportionalRate)} = ${fmt억(step2.rightsValue)}`}
        />
        <Step2Row
          label={`조합원 분양 총액 (희망 ${step2.desiredPyung}평 전용)`}
          value={step2.memberSaleTotalForUnit}
          onChange={(v) => setS2("memberSaleTotalForUnit", v)}
          suffix="원"
          note={`계산: ${fmt만(step2.memberSalePricePerPyung)}/평 × ${step2.desiredPyung}평(전용) × 1.35(공급환산) = ${fmt억(step2.memberSaleTotalForUnit)}`}
        />
        <Step2Row
          label="분담금"
          value={step2.contribution}
          onChange={(v) => setS2("contribution", v)}
          bold
          suffix="원"
          note={
            <>
              계산: 조합원분양총액 - 권리가액
              <br />
              = {fmt억(step2.memberSaleTotalForUnit)} - {fmt억(step2.rightsValue)} = <span className={step2.contribution != null ? (step2.contribution >= 0 ? "text-red-600 font-semibold" : "text-blue-600 font-semibold") : ""}>{fmt억(step2.contribution)}</span>
              {step2.contribution != null && (step2.contribution >= 0 ? " (추가 납부)" : " (환급)")}
            </>
          }
        />
      </section>

    </div>
  );
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
  const [currentPyungUnit, setCurrentPyungUnit] = useState<"pyung" | "sqm">("pyung");
  const [currentSqmRaw, setCurrentSqmRaw]       = useState("");
  const [pyungUnit, setPyungUnit] = useState<"pyung" | "sqm">("pyung");
  const [sqmRaw, setSqmRaw]       = useState("");

  // 1단계 상태
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error]     = useState<string | null>(null);
  const [step1, setStep1]               = useState<Step1Data | null>(null);

  const [showCostPredictor, setShowCostPredictor] = useState(false);
  const [costPredictMonths, setCostPredictMonths] = useState(36);

  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Error, setStep2Error]     = useState<string | null>(null);
  const [step2, setStep2]               = useState<Step2Data | null>(null);

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

  async function handleStep2() {
    if (!input.zoneId || !step1) return;
    setStep2Loading(true);
    setStep2Error(null);
    const { data, error } = await fetchStep2Data(input.zoneId, step1, input.desiredPyung);
    if (error || !data) setStep2Error(error ?? "알 수 없는 오류");
    else setStep2(data);
    setStep2Loading(false);
    setTimeout(() => {
      document.getElementById("step2-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function setS2<K extends keyof Step2Data>(key: K, value: Step2Data[K]) {
    setStep2((prev) => prev ? { ...prev, [key]: value } : prev);
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

          {/* 현재 평형 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">현재 보유 평형</label>
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 text-xs">
                <button type="button" onClick={() => setCurrentPyungUnit("pyung")}
                  className={`px-2.5 py-1 font-medium transition-colors ${currentPyungUnit === "pyung" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
                  평형
                </button>
                <button type="button" onClick={() => setCurrentPyungUnit("sqm")}
                  className={`px-2.5 py-1 font-medium transition-colors ${currentPyungUnit === "sqm" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
                  ㎡
                </button>
              </div>
            </div>
            {currentPyungUnit === "pyung" ? (
              <input type="number" value={input.currentPyung || ""} onChange={(e) => set("currentPyung", Number(e.target.value))}
                placeholder="예: 18, 25"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            ) : (
              <input type="number" value={currentSqmRaw} onChange={(e) => {
                setCurrentSqmRaw(e.target.value);
                const sqm = parseFloat(e.target.value);
                if (sqm > 0) set("currentPyung", Math.round((sqm / 3.3058) * 10) / 10);
              }}
                placeholder="예: 59.97"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {input.currentPyung > 0 && (
              <p className="text-xs font-semibold text-blue-600">
                {currentPyungUnit === "sqm"
                  ? `≈ ${input.currentPyung}평 (${(input.currentPyung * 3.3058).toFixed(1)}㎡)`
                  : `≈ ${(input.currentPyung * 3.3058).toFixed(1)}㎡`}
              </p>
            )}
          </div>

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
              {/* 평당 공사비 + 예측 버튼 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-zinc-500">평당 공사비 (원/평)</label>
                  <button
                    type="button"
                    onClick={() => {
                      // 착공까지 남은 개월 자동 계산
                      if (!showCostPredictor && step1.dateConstruction == null) {
                        const lastDate = step1.dateMgmtDisposal ?? step1.dateProjectImpl ?? step1.dateAssociation;
                        if (lastDate) {
                          const elapsed = Math.max(0,
                            (new Date().getFullYear() - new Date(lastDate).getFullYear()) * 12 +
                            (new Date().getMonth() - new Date(lastDate).getMonth())
                          );
                          setCostPredictMonths(Math.max(12, 36 - elapsed));
                        }
                      }
                      setShowCostPredictor(v => !v);
                    }}
                    className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap transition-colors"
                  >
                    {showCostPredictor ? "닫기" : "착공 시점 공사비 예측"}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={step1.constructionCostPerPyung ?? ""}
                    onChange={(e) => setS1("constructionCostPerPyung", e.target.value === "" ? null : Number(e.target.value))}
                    className="border border-zinc-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-zinc-400 whitespace-nowrap">원/평</span>
                </div>
              </div>
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

            {/* 착공 시점 공사비 예측 */}
            {showCostPredictor && step1.constructionCostPerPyung != null && (() => {
              const C0 = step1.constructionCostPerPyung;
              const T  = costPredictMonths;
              const R_RECENT = 0.007;   // 월 0.7% — 최근 급등세
              const R_LONG   = 0.002;   // 월 0.2% — 장기 평균
              const DECAY    = 0.04;
              const W    = Math.exp(-DECAY * T);
              const rAdj = W * R_RECENT + (1 - W) * R_LONG;
              const CT   = Math.round(C0 * Math.pow(1 + rAdj, T) / 10_000) * 10_000;
              const rPct = (rAdj * 100).toFixed(3);
              const increase = CT - C0;
              const increasePct = ((increase / C0) * 100).toFixed(1);
              return (
                <div className="bg-blue-50 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-700">착공 시점 공사비 예측</span>
                    <span className="text-xs text-zinc-400">(중립 시나리오)</span>
                  </div>
                  {/* 착공까지 개월 입력 */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-zinc-600 whitespace-nowrap">착공까지 남은 개월</label>
                    <input
                      type="number"
                      value={costPredictMonths}
                      onChange={(e) => setCostPredictMonths(Math.max(1, Number(e.target.value)))}
                      className="border border-blue-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="text-xs text-zinc-400">개월</span>
                  </div>
                  {/* 예측 결과 */}
                  <div className="flex items-baseline gap-3">
                    <span className="text-lg font-bold text-blue-800">{CT.toLocaleString()}원/평</span>
                    <span className="text-xs text-blue-600">+{increasePct}% ({(increase / 10_000).toFixed(0)}만원↑)</span>
                  </div>
                  {/* 계산 과정 */}
                  <div className="text-xs text-zinc-500 leading-relaxed space-y-0.5">
                    <p>W = e<sup>-{DECAY}×{T}</sup> = {W.toFixed(4)}&nbsp;(감쇠가중치, T 클수록 장기 수렴)</p>
                    <p>r_adj = {W.toFixed(4)} × {(R_RECENT*100).toFixed(1)}%/월 + (1-{W.toFixed(4)}) × {(R_LONG*100).toFixed(1)}%/월 = {rPct}%/월</p>
                    <p>C_T = {(C0/10000).toFixed(0)}만 × (1 + {rPct}%)<sup>{T}</sup> = <span className="font-semibold text-zinc-700">{(CT/10000).toFixed(0)}만원/평</span></p>
                    <p className="text-zinc-400 mt-1">기준: r_recent 0.7%/월(최근 급등), r_long 0.2%/월(장기 평균), λ={DECAY}</p>
                  </div>
                  {/* 이 값 적용 버튼 */}
                  <button
                    type="button"
                    onClick={() => setS1("constructionCostPerPyung", CT)}
                    className="self-start text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    이 값으로 평당 공사비 적용
                  </button>
                </div>
              );
            })()}

            {step1.constructionCostPerPyung != null && !showCostPredictor && (
              <p className="text-xs text-zinc-400">
                현재 시점 추정 공사비: <span className="font-semibold text-zinc-700">{step1.constructionCostPerPyung.toLocaleString()}원</span>
                {step1.kosisIndex != null && ` (KOSIS ${step1.kosisIndex} 지수 반영)`}
              </p>
            )}
          </section>

          {/* ⑧ 예상 조합원 분양가 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-700 border-b border-zinc-100 pb-1">⑧ 예상 조합원 분양가</h3>
            <div className="max-w-xs">
              <NullableNumInput
                label="평당 조합원 분양가 (원/평)"
                value={step1.memberSalePricePerPyung}
                onChange={(v) => setS1("memberSalePricePerPyung", v)}
                suffix="원/평"
              />
              {step1.memberSalePricePerPyung != null && step1.memberSalePricePerPyung > 0 && (
                <p className="text-xs font-semibold text-blue-600 mt-1">
                  {(step1.memberSalePricePerPyung / 10_000).toFixed(0)}만원/평
                </p>
              )}
            </div>
          </section>

          {/* 2단계 버튼 */}
          <div className="pt-2 flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={handleStep2}
              disabled={step2Loading || !step1.officialPrice || step1.officialPrice <= 0}
              className="rounded-xl bg-emerald-600 text-white font-bold px-8 py-3.5 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
            >
              {step2Loading ? "계산 중..." : "2단계 실행 →"}
            </button>
            <p className="text-xs text-zinc-400">중립 시나리오{!step1.officialPrice || step1.officialPrice <= 0 ? " · 공시가격 입력 후 활성화" : ""}</p>
            {step2Error && (
              <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-1">오류: {step2Error}</p>
            )}
          </div>

        </div>
      )}

      {/* ── 2단계 결과 ──────────────────────────────────────────────────────── */}
      {step2 && (
        <div id="step2-section" className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 flex flex-col gap-8">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">2단계 · 중립 시나리오</span>
            <h2 className="font-bold text-zinc-900 mt-0.5">사업성 분석</h2>
            <p className="text-xs text-zinc-400 mt-0.5">자동 계산된 값입니다. 수정이 필요한 항목은 직접 편집하세요.</p>
          </div>

          <Step2Section step2={step2} setS2={setS2} />
        </div>
      )}

    </div>
  );
}

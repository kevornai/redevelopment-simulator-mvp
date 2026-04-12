"use client";

import { useState } from "react";
import { calculateAnalysis, CalculationInput, CalculationResult, ScenarioResult } from "@/app/actions/calculate";
import { zones } from "@/data/zones";

function formatWon(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}억`;
  if (abs >= 10000000)  return `${sign}${(abs / 10000000).toFixed(0)}천만`;
  if (abs >= 1000000)   return `${sign}${(abs / 1000000).toFixed(0)}백만`;
  return `${sign}${abs.toLocaleString()}원`;
}

function formatPyung(value: number): string {
  return `${(value / 10000).toFixed(0)}만원/평`;
}

const SCENARIO_STYLES = {
  optimistic:  { border: "border-blue-200",  bg: "bg-blue-50",  badge: "bg-blue-100 text-blue-700",  label: "낙관" },
  neutral:     { border: "border-zinc-200",  bg: "bg-zinc-50",  badge: "bg-zinc-100 text-zinc-700",  label: "중립" },
  pessimistic: { border: "border-red-200",   bg: "bg-red-50",   badge: "bg-red-100 text-red-700",    label: "비관" },
};

function ScenarioCard({ result }: { result: ScenarioResult }) {
  const s = SCENARIO_STYLES[result.scenarioType];
  const isProfit = result.netProfit >= 0;
  const isRefund = result.additionalContribution < 0;

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-6 flex flex-col gap-4`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.badge}`}>
          {s.label}
        </span>
        <span className="text-sm text-zinc-500">{result.appliedMonths}개월 사업 기간 적용</span>
      </div>

      {/* 핵심 지표 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-xs text-zinc-400 mb-1">비례율</p>
          <p className="text-xl font-bold text-zinc-900">{result.proportionalRate}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400 mb-1">{isRefund ? "환급금" : "추가 분담금"}</p>
          <p className={`text-xl font-bold ${isRefund ? "text-blue-600" : "text-red-600"}`}>
            {formatWon(Math.abs(result.additionalContribution))}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400 mb-1">예상 ROE</p>
          <p className={`text-xl font-bold ${isProfit ? "text-blue-600" : "text-red-600"}`}>
            {result.returnOnEquity > 0 ? "+" : ""}{result.returnOnEquity}%
          </p>
        </div>
      </div>

      <hr className="border-zinc-200" />

      {/* 상세 지표 */}
      <div className="flex flex-col gap-2 text-sm">
        <Row label="예상 감정평가액" value={formatWon(result.estimatedAppraisalValue)} />
        <Row label="프리미엄 (웃돈)" value={`${formatWon(result.estimatedPremium)} (버블지수 ${result.premiumBubbleIndex}%)`} />
        <Row label="권리가액" value={formatWon(result.rightsValue)} />
        <Row label="총 투자 원금" value={formatWon(result.totalInvestmentCost)} highlight />
        <Row label="초기 실투자금 (현금)" value={formatWon(result.actualInitialInvestment)} />
        <Row
          label="예상 시세 차익"
          value={formatWon(result.netProfit)}
          color={isProfit ? "text-blue-600" : "text-red-600"}
          highlight
        />
        <Row label="평당 공사비 (적용)" value={formatPyung(result.appliedConstructionCostPerPyung)} />
        <Row label="일반 분양가 (적용)" value={formatPyung(result.appliedGeneralSalePrice)} />
        <Row label="손익분기 공사비 한계" value={formatPyung(result.cushionAgainstCostIncrease)} />
      </div>
    </div>
  );
}

function Row({
  label, value, highlight, color,
}: {
  label: string; value: string; highlight?: boolean; color?: string;
}) {
  return (
    <div className={`flex justify-between ${highlight ? "font-semibold" : ""}`}>
      <span className="text-zinc-500">{label}</span>
      <span className={color ?? "text-zinc-800"}>{value}</span>
    </div>
  );
}

export default function ReportTestClient() {
  const [form, setForm] = useState<CalculationInput>({
    zoneId: "hannam3",
    propertyType: "villa",
    purchasePrice: 1200000000,    // 12억
    currentDeposit: 300000000,    // 3억 (세입자 보증금)
    desiredPyung: 59,
    officialValuation: 500000000, // 5억 공시가
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const { data, error: calcError } = await calculateAnalysis(form);
    if (calcError) {
      setError(calcError);
    } else {
      setResult(data);
    }
    setLoading(false);
  }

  function handleChange(key: keyof CalculationInput, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">
      {/* 헤더 */}
      <div>
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-widest">
          내부 테스트 전용
        </span>
        <h1 className="text-3xl font-bold text-zinc-900 mt-1">계산 엔진 테스트</h1>
        <p className="text-zinc-500 text-sm mt-1">
          스프레드시트 계산식 기반 · 실제 서비스 출시 전 검증용
        </p>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 flex flex-col gap-6">
        <h2 className="font-semibold text-zinc-900 text-lg">입력값</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 관심 구역 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">관심 구역</label>
            <select
              value={form.zoneId}
              onChange={(e) => handleChange("zoneId", e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(zones).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">현재 DB 데이터: 한남3구역만 지원</p>
          </div>

          {/* 물건 유형 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">물건 유형</label>
            <select
              value={form.propertyType}
              onChange={(e) => handleChange("propertyType", e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="villa">빌라</option>
              <option value="house">단독주택</option>
            </select>
          </div>

          {/* 매수 희망가 */}
          <NumberInput
            label="매수 희망가 (원)"
            value={form.purchasePrice}
            onChange={(v) => handleChange("purchasePrice", v)}
            placeholder="예: 1200000000 (12억)"
          />

          {/* 전/월세 보증금 */}
          <NumberInput
            label="현재 전/월세 보증금 (원)"
            value={form.currentDeposit}
            onChange={(v) => handleChange("currentDeposit", v)}
            placeholder="예: 300000000 (3억)"
          />

          {/* 희망 평형 */}
          <NumberInput
            label="희망 조합원 분양 평형 (평)"
            value={form.desiredPyung}
            onChange={(v) => handleChange("desiredPyung", v)}
            placeholder="예: 59, 84"
          />

          {/* 공시가격 */}
          <NumberInput
            label="공동주택 공시가격 (원)"
            value={form.officialValuation}
            onChange={(v) => handleChange("officialValuation", v)}
            placeholder="예: 500000000 (5억)"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {loading ? "계산 중..." : "시나리오 분석 실행"}
        </button>
      </form>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">
              {result.zoneName} — 3가지 시나리오 분석 결과
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              계산 시각: {new Date(result.calculatedAt).toLocaleString("ko-KR")}
            </p>
          </div>

          {/* 입력값 요약 */}
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 text-sm flex flex-wrap gap-x-6 gap-y-1 text-zinc-600">
            <span>매수가: <strong>{formatWon(result.input.purchasePrice)}</strong></span>
            <span>보증금: <strong>{formatWon(result.input.currentDeposit)}</strong></span>
            <span>희망 평형: <strong>{result.input.desiredPyung}평</strong></span>
            <span>공시가: <strong>{formatWon(result.input.officialValuation)}</strong></span>
          </div>

          {/* 3 시나리오 카드 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ScenarioCard result={result.optimistic} />
            <ScenarioCard result={result.neutral} />
            <ScenarioCard result={result.pessimistic} />
          </div>

          <p className="text-xs text-zinc-400 text-center">
            본 분석 결과는 테스트용 추정값이며 실제 투자 결과를 보장하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

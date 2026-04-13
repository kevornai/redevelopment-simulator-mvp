"use client";

import { useState } from "react";
import {
  calculateAnalysis,
  CalculationInput,
  CalculationResult,
  ScenarioResult,
  StageCashFlow,
} from "@/app/actions/calculate";
import { zones } from "@/data/zones";

// ─────────────────────────────────────────────────────────────────────────────
// 포맷 유틸
// ─────────────────────────────────────────────────────────────────────────────

function fWon(value: number, short = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (short) {
    if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}억`;
    if (abs >= 10000000)  return `${sign}${(abs / 10000000).toFixed(0)}천만`;
    return `${sign}${(abs / 1000000).toFixed(0)}백만`;
  }
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}억원`;
  if (abs >= 10000000)  return `${sign}${(abs / 10000000).toFixed(1)}천만원`;
  if (abs >= 1000000)   return `${sign}${(abs / 1000000).toFixed(0)}백만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

function fPct(v: number, sign = false): string {
  return `${sign && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fMonth(m: number): string {
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo}개월`;
  if (mo === 0) return `${y}년`;
  return `${y}년 ${mo}개월`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 시나리오 스타일
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  optimistic:  { border: "border-blue-200",  header: "bg-blue-600",   badge: "bg-blue-100 text-blue-700",  text: "text-blue-600",  emoji: "📈" },
  neutral:     { border: "border-zinc-300",  header: "bg-zinc-700",   badge: "bg-zinc-100 text-zinc-700",  text: "text-zinc-700",  emoji: "📊" },
  pessimistic: { border: "border-red-200",   header: "bg-red-600",    badge: "bg-red-100 text-red-700",    text: "text-red-600",   emoji: "📉" },
};

// ─────────────────────────────────────────────────────────────────────────────
// 핵심 지표 게이지 (비례율 시각화)
// ─────────────────────────────────────────────────────────────────────────────

function ProportionalGauge({ rate }: { rate: number }) {
  const clamped = Math.min(Math.max(rate, 0), 150);
  const pct = (clamped / 150) * 100;
  const color =
    rate >= 100 ? "bg-blue-500" : rate >= 80 ? "bg-yellow-400" : "bg-red-500";
  const label =
    rate >= 110 ? "매우 양호" : rate >= 100 ? "양호" : rate >= 90 ? "보통" : rate >= 80 ? "주의" : "위험";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-zinc-400 mb-0.5">
        <span>0%</span><span>80%</span><span>100%</span><span>150%</span>
      </div>
      <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-sm font-bold text-zinc-800">{fPct(rate)}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          rate >= 100 ? "bg-blue-100 text-blue-700" :
          rate >= 80  ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
        }`}>{label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 단계별 현금흐름 타임라인
// ─────────────────────────────────────────────────────────────────────────────

function CashFlowTimeline({ flows }: { flows: StageCashFlow[] }) {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {flows.map((f, i) => {
        const isPositive = f.netCashPosition >= 0;
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                f.stage === "completion" ? "bg-blue-500" : "bg-zinc-300"
              }`} />
              {i < flows.length - 1 && (
                <div className="w-px flex-1 bg-zinc-200 mt-1 min-h-[20px]" />
              )}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-700">{f.label}</span>
                <span className="text-xs text-zinc-400">+{fMonth(f.monthFromNow)}</span>
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-xs text-zinc-400">누적 포지션</span>
                <span className={`text-xs font-bold ${isPositive ? "text-blue-600" : "text-red-600"}`}>
                  {fWon(f.netCashPosition, true)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 시나리오 카드
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioCard({ r }: { r: ScenarioResult }) {
  const [expanded, setExpanded] = useState(false);
  const st = S[r.scenarioType];
  const isProfit = r.netProfit >= 0;
  const isRefund = r.additionalContribution < 0;
  const npvPositive = r.npv >= 0;

  return (
    <div className={`rounded-2xl border ${st.border} overflow-hidden`}>
      {/* 헤더 */}
      <div className={`${st.header} text-white px-5 py-3 flex justify-between items-center`}>
        <span className="font-bold text-sm">
          {st.emoji} {r.scenarioLabel}
        </span>
        <span className="text-xs opacity-80">{fMonth(r.appliedMonths)} 소요</span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 핵심 KPI 3개 */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400 mb-1">예상 시세 차익</p>
            <p className={`text-lg font-bold leading-tight ${isProfit ? "text-blue-600" : "text-red-600"}`}>
              {fWon(r.netProfit, true)}
            </p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400 mb-1">연환산 수익률</p>
            <p className={`text-lg font-bold leading-tight ${r.annualizedReturn >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {fPct(r.annualizedReturn, true)}
            </p>
          </div>
          <div className="bg-zinc-50 rounded-xl p-3">
            <p className="text-[10px] text-zinc-400 mb-1">IRR (연)</p>
            <p className={`text-lg font-bold leading-tight ${r.irr >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {fPct(r.irr, true)}
            </p>
          </div>
        </div>

        {/* 비례율 게이지 */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 mb-2">비례율</p>
          <ProportionalGauge rate={r.proportionalRate} />
        </div>

        {/* 핵심 지표 요약 */}
        <div className="flex flex-col gap-1.5 text-sm">
          <Row label="추가 분담금" value={isRefund ? `${fWon(Math.abs(r.additionalContribution))} 환급` : fWon(r.additionalContribution)} color={isRefund ? "text-blue-600" : "text-red-600"} />
          <Row label="├ 착공 시 납부" value={r.additionalContribution > 0 ? fWon(r.contributionAtConstruction) : "—"} indent />
          <Row label="└ 입주 시 납부" value={r.additionalContribution > 0 ? fWon(r.contributionAtCompletion) : "—"} indent />
          <Row label="총 투자 원금" value={fWon(r.totalInvestmentCost)} highlight />
          <Row label="부대비용 포함 총비용" value={fWon(r.totalInvestmentWithCosts)} />
          <Row label="NPV" value={fWon(r.npv)} color={npvPositive ? "text-blue-600" : "text-red-600"} />
          <Row label="기회비용 대비" value={`${r.opportunityCostGap >= 0 ? "+" : ""}${fWon(r.opportunityCostGap, true)}`} color={r.opportunityCostGap >= 0 ? "text-blue-600" : "text-zinc-500"} />
        </div>

        {/* 더보기 토글 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors text-center"
        >
          {expanded ? "▲ 접기" : "▼ 상세 지표 펼치기"}
        </button>

        {expanded && (
          <div className="flex flex-col gap-4">
            <hr className="border-zinc-100" />

            {/* 감정평가 & 프리미엄 */}
            <Section title="감정평가 & 프리미엄">
              <Row label="예상 감정평가액" value={fWon(r.estimatedAppraisalValue)} />
              <Row label="권리가액" value={fWon(r.rightsValue)} />
              <Row label="프리미엄 (웃돈)" value={fWon(r.estimatedPremium)} />
              <Row label="프리미엄 버블지수" value={fPct(r.premiumBubbleIndex)} color={r.premiumBubbleIndex > 50 ? "text-red-600" : "text-zinc-700"} />
              <Row label="프리미엄 회수 소요" value={`${r.premiumRecoveryYears.toFixed(1)}년 (연 2% 상승 가정)`} />
            </Section>

            {/* 공사비 & 분양가 */}
            <Section title="공사비 & 분양가 (적용값)">
              <Row label="평당 공사비" value={`${fWon(r.appliedConstructionCostPerPyung, true)}/평`} />
              <Row label="월 인상률 적용값" value={`${r.constructionCostGrowthRate}%`} />
              <Row label="평당 일반분양가" value={`${fWon(r.appliedGeneralSalePrice, true)}/평`} />
            </Section>

            {/* 부대 비용 */}
            <Section title="부대 비용 (취득세·이자·이사비)">
              <Row label="취득세 (추정)" value={fWon(r.acquisitionTax)} />
              <Row label="보유기간 이자 비용" value={fWon(r.holdingInterestCost)} />
              <Row label="이사/명도비" value={fWon(r.moveOutCost)} />
              <Row label="부대비용 합계" value={fWon(r.totalAdditionalCosts)} highlight />
            </Section>

            {/* 수익률 */}
            <Section title="수익률 분석">
              <Row label="ROE (실투자금 기준)" value={fPct(r.returnOnEquity, true)} color={r.returnOnEquity >= 0 ? "text-blue-600" : "text-red-600"} />
              <Row label="ROI (총비용 기준)" value={fPct(r.returnOnTotalInvestment, true)} color={r.returnOnTotalInvestment >= 0 ? "text-blue-600" : "text-red-600"} />
              <Row label="연환산 수익률" value={fPct(r.annualizedReturn, true)} color={r.annualizedReturn >= 0 ? "text-blue-600" : "text-red-600"} />
              <Row label="IRR (연)" value={fPct(r.irr, true)} color={r.irr >= 0 ? "text-blue-600" : "text-red-600"} />
            </Section>

            {/* 리스크 지표 */}
            <Section title="리스크 & 손익분기">
              <Row label="손익분기 분양가" value={`${fWon(r.breakEvenGeneralSalePrice, true)}/평`} />
              <Row label="최대 감당 분담금" value={fWon(r.maxAffordableContribution)} />
              <Row label="사업 기간" value={`${fMonth(r.appliedMonths)} (착공까지 ${fMonth(r.monthsToConstructionStart)})`} />
            </Section>

            {/* 단계별 현금흐름 */}
            <Section title="단계별 현금 포지션">
              <CashFlowTimeline flows={r.stageCashFlows} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, highlight, color, indent,
}: {
  label: string; value: string; highlight?: boolean; color?: string; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between ${highlight ? "font-semibold" : ""} ${indent ? "pl-3" : ""}`}>
      <span className={`${indent ? "text-zinc-400" : "text-zinc-500"} text-sm`}>{label}</span>
      <span className={`text-sm ${color ?? "text-zinc-800"}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 비교 요약 테이블
// ─────────────────────────────────────────────────────────────────────────────

function ComparisonTable({ result }: { result: CalculationResult }) {
  const rows: Array<{ label: string; key: keyof ScenarioResult; format: (v: number) => string; color?: boolean }> = [
    { label: "사업 기간",       key: "appliedMonths",            format: fMonth },
    { label: "비례율",          key: "proportionalRate",         format: (v) => fPct(v), color: true },
    { label: "추가 분담금",     key: "additionalContribution",   format: (v) => fWon(v, true), color: true },
    { label: "총 투자 원금",    key: "totalInvestmentCost",      format: (v) => fWon(v, true) },
    { label: "부대비용 포함",   key: "totalInvestmentWithCosts", format: (v) => fWon(v, true) },
    { label: "예상 시세 차익",  key: "netProfit",                format: (v) => fWon(v, true), color: true },
    { label: "연환산 수익률",   key: "annualizedReturn",         format: (v) => fPct(v, true), color: true },
    { label: "IRR (연)",        key: "irr",                      format: (v) => fPct(v, true), color: true },
    { label: "NPV",             key: "npv",                      format: (v) => fWon(v, true), color: true },
    { label: "프리미엄 버블",   key: "premiumBubbleIndex",       format: (v) => fPct(v) },
  ];

  const scenarios = [result.optimistic, result.neutral, result.pessimistic];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-zinc-50">
            <th className="text-left px-4 py-2 font-semibold text-zinc-500 border-b border-zinc-200 w-1/3">지표</th>
            {scenarios.map((s) => (
              <th key={s.scenarioType} className="text-center px-4 py-2 font-semibold border-b border-zinc-200 text-zinc-700">
                {S[s.scenarioType].emoji} {s.scenarioLabel.replace(" 시나리오", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-zinc-100 hover:bg-zinc-50">
              <td className="px-4 py-2 text-zinc-500">{row.label}</td>
              {scenarios.map((s) => {
                const val = s[row.key] as number;
                let colorClass = "text-zinc-800";
                if (row.color) {
                  colorClass = val >= 0 ? "text-blue-600" : "text-red-600";
                }
                return (
                  <td key={s.scenarioType} className={`px-4 py-2 text-center font-medium ${colorClass}`}>
                    {row.format(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

const RECONSTRUCTION_ZONES = new Set(["banpo", "gaepo", "gaepo4", "dunchon", "chamsil", "gwacheon", "gwacheon1", "gwacheon2"]);

export default function ReportTestClient() {
  const [form, setForm] = useState<CalculationInput>({
    zoneId: "hannam3",
    projectType: "redevelopment",
    propertyType: "villa",
    purchasePrice: 1200000000,
    purchaseLoanAmount: 600000000,   // 대출 6억
    currentDeposit: 300000000,
    desiredPyung: 59,
    officialValuation: 500000000,
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"cards" | "table">("cards");

  function handleZoneChange(zoneId: string) {
    const isRecon = RECONSTRUCTION_ZONES.has(zoneId);
    setForm((prev) => ({
      ...prev,
      zoneId,
      projectType: isRecon ? "reconstruction" : "redevelopment",
      propertyType: isRecon ? "apartment" : "villa",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const { data, error: calcError } = await calculateAnalysis(form);
    if (calcError) setError(calcError);
    else setResult(data);
    setLoading(false);
  }

  function set<K extends keyof CalculationInput>(key: K, value: CalculationInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-10">
      {/* 헤더 */}
      <div>
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-widest">내부 테스트 전용</span>
        <h1 className="text-3xl font-bold text-zinc-900 mt-1">재개발·재건축 계산 엔진</h1>
        <p className="text-zinc-400 text-sm mt-1">
          비례율 · 권리가액 · 분담금 · IRR · NPV · 단계별 현금흐름 · 기회비용 분석
        </p>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-zinc-900">입력값</h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            form.projectType === "reconstruction"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}>
            {form.projectType === "reconstruction" ? "🏢 재건축" : "🏘️ 재개발"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 구역 선택 */}
          <div className="flex flex-col gap-1.5 lg:col-span-2">
            <label className="text-sm font-medium text-zinc-700">관심 구역</label>
            <select
              value={form.zoneId}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="── 재개발 (강북권)">
                {["hannam3","hannam2","hannam4","hannam5","noryangjin1","noryangjin2","noryangjin3","noryangjin5","heukseok2","heukseok3","singil1","singil4","singil5","singil6","dapsimni","wangsimni","majang","seongsu"].map(id => (
                  <option key={id} value={id}>{zones[id]}</option>
                ))}
              </optgroup>
              <optgroup label="── 재건축 (강남권)">
                {["banpo","gaepo","gaepo4","dunchon","chamsil","seocho","heukseok9"].map(id => (
                  <option key={id} value={id}>{zones[id]}</option>
                ))}
              </optgroup>
              <optgroup label="── 재개발 (서북권)">
                {["ahyeon","mapo","gajwa","yeonninnae"].map(id => (
                  <option key={id} value={id}>{zones[id] ?? id}</option>
                ))}
              </optgroup>
              <optgroup label="── 재건축 (경기도)">
                {["gwacheon","gwacheon1","gwacheon2"].map(id => (
                  <option key={id} value={id}>{zones[id]}</option>
                ))}
              </optgroup>
            </select>
            <p className="text-xs text-zinc-400">
              현재 DB 데이터: 한남3구역(재개발), 반포주공1단지(재건축) 지원
            </p>
          </div>

          {/* 물건 유형 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">물건 유형</label>
            <select
              value={form.propertyType}
              onChange={(e) => set("propertyType", e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {form.projectType === "reconstruction"
                ? <option value="apartment">아파트</option>
                : <>
                    <option value="villa">빌라</option>
                    <option value="house">단독주택</option>
                  </>
              }
            </select>
          </div>

          <NumberInput label="매수 희망가 (원)" value={form.purchasePrice} onChange={(v) => set("purchasePrice", v)} placeholder="예: 1200000000 (12억)" />
          <NumberInput label="매수 시 대출금 (원)" value={form.purchaseLoanAmount} onChange={(v) => set("purchaseLoanAmount", v)} placeholder="예: 600000000 (6억)" note="보유기간 이자 계산에 사용" />
          <NumberInput label="현재 전/월세 보증금 (원)" value={form.currentDeposit} onChange={(v) => set("currentDeposit", v)} placeholder="예: 300000000 (3억)" />
          <NumberInput label="희망 조합원 분양 평형 (평)" value={form.desiredPyung} onChange={(v) => set("desiredPyung", v)} placeholder="예: 59, 84" />
          <NumberInput label="공동주택 공시가격 (원)" value={form.officialValuation} onChange={(v) => set("officialValuation", v)} placeholder="예: 500000000 (5억)" note="국토부 부동산 공시가격 알리미 조회" />
        </div>

        {/* 실투자금 미리보기 */}
        <div className="bg-blue-50 rounded-xl p-4 text-sm flex flex-wrap gap-x-8 gap-y-1">
          <span className="text-zinc-500">실투자 현금 (대출·보증금 제외):
            <strong className="text-zinc-900 ml-2">
              {fWon(form.purchasePrice - form.purchaseLoanAmount - form.currentDeposit)}
            </strong>
          </span>
          <span className="text-zinc-500">LTV:
            <strong className="text-zinc-900 ml-2">
              {form.purchasePrice > 0
                ? `${((form.purchaseLoanAmount / form.purchasePrice) * 100).toFixed(0)}%`
                : "—"}
            </strong>
          </span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 text-white font-bold py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-60 text-base"
        >
          {loading ? "계산 중..." : "3가지 시나리오 분석 실행 →"}
        </button>
      </form>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="flex flex-col gap-6">
          {/* 결과 헤더 */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">
                {result.zoneName} 분석 결과
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {result.projectType === "reconstruction" ? "재건축" : "재개발"} ·{" "}
                {result.input.desiredPyung}평형 희망 ·{" "}
                매수가 {fWon(result.input.purchasePrice, true)} ·{" "}
                계산 {new Date(result.calculatedAt).toLocaleTimeString("ko-KR")}
              </p>
              {/* API 데이터 소스 배지 */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(
                  [
                    { label: "금리 (ECOS)", active: result.marketDataSources.ratesFromApi },
                    { label: "공사비지수 (KOSIS)", active: result.marketDataSources.constructionCostFromApi },
                    { label: "실거래가 (국토부)", active: result.marketDataSources.localPriceFromApi },
                    { label: "공시가격 (NSDI)", active: result.marketDataSources.publicPriceFromApi },
                  ] as const
                ).map(({ label, active }) => (
                  <span
                    key={label}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      active
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-100 text-zinc-400 line-through"
                    }`}
                  >
                    {active ? "● " : "○ "}{label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {(["cards", "table"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {tab === "cards" ? "카드 뷰" : "비교 테이블"}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "cards" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <ScenarioCard r={result.optimistic} />
              <ScenarioCard r={result.neutral} />
              <ScenarioCard r={result.pessimistic} />
            </div>
          )}

          {activeTab === "table" && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <ComparisonTable result={result} />
            </div>
          )}

          {/* 공사비 인상 설명 */}
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-5 text-sm flex flex-col gap-2">
            <p className="font-bold text-zinc-700">📐 공사비 예측 방법론 (지수평활법)</p>
            <p className="text-zinc-500 leading-relaxed">
              <strong>중립/낙관:</strong> W = e<sup>-λ×T</sup> 감쇠 가중치로 최근 급등세가 장기 평균으로 수렴.
              W×r_recent + (1-W)×r_long 혼합 월 인상률에 복리(지수) 적용.{" "}
              {`중립 적용률: ${fPct(result.neutral.constructionCostGrowthRate)}/월`}
            </p>
            <p className="text-zinc-500 leading-relaxed">
              <strong>비관:</strong> 지수평활 배제. 최근 급등세(r_recent) + 지정학적 위기 프리미엄(α) 그대로 유지.{" "}
              {`비관 적용률: ${fPct(result.pessimistic.constructionCostGrowthRate)}/월`}
            </p>
          </div>

          <p className="text-xs text-zinc-400 text-center">
            본 분석 결과는 내부 테스트용이며 실제 투자 결과를 보장하지 않습니다.
            구역 데이터는 공개 정보 기반 추정값으로 실제 서비스 전 정확한 값으로 교체 필요.
          </p>
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label, value, onChange, placeholder, note,
}: {
  label: string; value: number; onChange: (v: number) => void; placeholder?: string; note?: string;
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
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}

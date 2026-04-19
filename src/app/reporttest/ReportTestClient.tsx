"use client";

import React, { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  calculateAnalysis,
  CalculationInput,
  CalculationResult,
  ScenarioResult,
  StageCashFlow,
} from "@/app/actions/calculate";
import type { ZoneMapMeta } from "@/components/map/zone-coords";

interface ZoneListItem {
  zone_id: string;
  zone_name: string | null;
  project_type: string;
  project_stage: string;
}

// 카카오 지도 SDK는 브라우저 전용 → SSR 비활성화
const ZoneMap = dynamic(() => import("@/components/map/ZoneMap"), { ssr: false });

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

function ScenarioCard({ r, desiredPyung }: { r: ScenarioResult; desiredPyung: number }) {
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
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    예상 감정평가액
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      r.appraisalMethod === "land_based"    ? "bg-blue-100 text-blue-700" :
                      r.appraisalMethod === "official_rate" ? "bg-green-100 text-green-700" :
                                                              "bg-amber-100 text-amber-700"
                    }`}>
                      {r.appraisalMethod === "land_based"    ? "대지지분 기반" :
                       r.appraisalMethod === "official_rate" ? "공시가 기반" :
                                                               "매수가 역산 (추정)"}
                    </span>
                  </span>
                }
                value={fWon(r.estimatedAppraisalValue)}
              />
              <Row label="권리가액" value={fWon(r.rightsValue)} />
              <Row label="프리미엄 (웃돈)" value={fWon(r.estimatedPremium)} />
              <Row label="프리미엄 버블지수" value={fPct(r.premiumBubbleIndex)} color={r.premiumBubbleIndex > 50 ? "text-red-600" : "text-zinc-700"} />
              <Row label="프리미엄 회수 소요" value={`${r.premiumRecoveryYears.toFixed(1)}년 (연 2% 상승 가정)`} />
            </Section>

            {/* 공사비 & 분양가 */}
            <Section title="공사비 & 분양가 (적용값)">
              <Row label="평당 공사비" value={`${fWon(r.appliedConstructionCostPerPyung, true)}/평`} />
              <Row label="월 인상률 적용값" value={`${r.constructionCostGrowthRate}%`} />
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    평당 조합원 분양가
                    <SourceBadge source={r.memberSalePriceSource} />
                  </span>
                }
                value={`${fWon(r.targetMemberSalePrice / desiredPyung, true)}/평`}
              />
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
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    사업 기간
                    {r.scenarioType === "neutral" && (
                      <SourceBadge source={r.monthsToConstructionSource} />
                    )}
                  </span>
                }
                value={`${fMonth(r.appliedMonths)} (착공까지 ${fMonth(r.monthsToConstructionStart)})`}
              />
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
  label: React.ReactNode; value: string; highlight?: boolean; color?: string; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between ${highlight ? "font-semibold" : ""} ${indent ? "pl-3" : ""}`}>
      <span className={`${indent ? "text-zinc-400" : "text-zinc-500"} text-sm`}>{label}</span>
      <span className={`text-sm ${color ?? "text-zinc-800"}`}>{value}</span>
    </div>
  );
}

/** 데이터 출처 배지 — 어떤 값이 공표값/추정값/수동입력인지 표시 */
const SOURCE_BADGE_CONFIG = {
  announced:      { label: "공표값",   cls: "bg-green-100 text-green-700" },
  manual:         { label: "수동입력", cls: "bg-blue-100 text-blue-700"  },
  cost_estimated: { label: "추정값",   cls: "bg-yellow-100 text-yellow-700" },
  statistical:    { label: "통계추정", cls: "bg-zinc-100 text-zinc-500"  },
  db_percentile:  { label: "DB실측",   cls: "bg-indigo-100 text-indigo-700" },
  db_override:    { label: "시나리오", cls: "bg-zinc-100 text-zinc-500"  },
} as const;

function SourceBadge({ source }: { source: keyof typeof SOURCE_BADGE_CONFIG }) {
  const cfg = SOURCE_BADGE_CONFIG[source] ?? SOURCE_BADGE_CONFIG.manual;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.cls}`}>
      {cfg.label}
    </span>
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

// ─────────────────────────────────────────────────────────────────────────────
// 할인율 매트릭스
// ─────────────────────────────────────────────────────────────────────────────

const DISCOUNT_RATES = [5, 10, 15, 20, 25, 30] as const;

function computeMatrixCell(
  b: ScenarioResult["calcBreakdown"],
  discountPct: number,
  personalAppraisal: number,
  desiredPyung: number,
) {
  const memberSalePrice = b.P * (1 - discountPct / 100);
  const memberRevenue = memberSalePrice * b.memberSaleAreaPyung;
  const totalRevenue = b.generalRevenue + memberRevenue;
  const propRate = b.totalAppraisalValue > 0
    ? (totalRevenue - b.totalCost) / b.totalAppraisalValue * 100
    : 0;
  const rightsValue = personalAppraisal * (propRate / 100);
  const contribution = memberSalePrice * desiredPyung - rightsValue;
  return { propRate, contribution };
}

function propRateCls(r: number, isNeutral = false): string {
  const c =
    r >= 115 ? "text-blue-700 bg-blue-50" :
    r >= 100 ? "text-green-700 bg-green-50" :
    r >=  85 ? "text-yellow-700 bg-yellow-50" :
               "text-red-700 bg-red-50";
  return isNeutral ? c.replace("50", "100") + " font-bold" : c;
}

function fmtContrib(c: number): string {
  const abs = Math.abs(c);
  const str = abs >= 1e8 ? `${(abs / 1e8).toFixed(1)}억` : `${(abs / 1e4).toFixed(0)}만`;
  return c < 0 ? `수령 ${str}` : `납부 ${str}`;
}

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

export default function ReportTestClient() {
  const [dbZones, setDbZones] = useState<ZoneListItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/zones-list")
      .then((r) => r.json())
      .then((d) => { if (d.zones) setDbZones(d.zones); })
      .catch(() => {});
  }, []);

  function isReconstruction(zoneId: string) {
    const z = dbZones.find((z) => z.zone_id === zoneId);
    return z ? z.project_type === "reconstruction" : false;
  }

  function getZoneName(zoneId: string) {
    return dbZones.find((z) => z.zone_id === zoneId)?.zone_name ?? zoneId;
  }

  const [form, setForm] = useState<CalculationInput>({
    zoneId: "banpo",
    projectType: "reconstruction",
    propertyType: "apartment",
    purchasePrice: 4500000000,
    purchaseLoanAmount: 2000000000,
    currentDeposit: 0,
    desiredPyung: 59,
    officialValuation: 0,
    landShareSqm: 0,
    admin: {},
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [pyungUnit, setPyungUnit] = useState<"pyung" | "sqm">("pyung");
  const [sqmRaw, setSqmRaw] = useState<string>("");

  function handleZoneChange(zoneId: string) {
    const recon = isReconstruction(zoneId);
    setForm((prev) => ({
      ...prev,
      zoneId,
      projectType: recon ? "reconstruction" : "redevelopment",
      propertyType: recon ? "apartment" : "villa",
    }));
  }

  // 지도 핀 클릭 시: 구역 변경 + 등록된 기본값 자동 채움
  // dbZones를 dependency에 포함해야 stale closure 방지
  const handleMapSelect = useCallback(
    (zoneId: string, projectType: string, defaults?: ZoneMapMeta["defaultValues"]) => {
      const recon = projectType === "reconstruction";
      setForm((prev) => ({
        ...prev,
        zoneId,
        projectType: recon ? "reconstruction" : "redevelopment",
        propertyType: recon ? "apartment" : "villa",
        ...(defaults?.purchasePrice    && { purchasePrice:    defaults.purchasePrice }),
        ...(defaults?.officialValuation && { officialValuation: defaults.officialValuation }),
        ...(defaults?.landShareSqm     && { landShareSqm:     defaults.landShareSqm }),
        ...(defaults?.desiredPyung     && { desiredPyung:     defaults.desiredPyung }),
      }));
      document.getElementById("analysis-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

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

  function setAdmin(key: keyof NonNullable<CalculationInput["admin"]>, value: number | string | undefined) {
    setForm((prev) => ({ ...prev, admin: { ...prev.admin, [key]: value || undefined } }));
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-10">
      {/* 헤더 */}
      <div>
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-widest">내부 테스트 전용</span>
        <h1 className="text-3xl font-bold text-zinc-900 mt-1">재건축 아파트 계산 엔진</h1>
        <p className="text-zinc-400 text-sm mt-1">
          비례율 · 권리가액 · 분담금 · IRR · NPV · 단계별 현금흐름 · 기회비용 분석
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          재개발(빌라) 분석은 준비 중입니다. 현재는 재건축 아파트만 지원합니다.
        </p>
      </div>

      {/* 구역 선택 지도 */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-bold text-zinc-900">관심 구역 선택</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            파란색 핀을 클릭하면 해당 구역의 기본값이 아래 폼에 자동 입력됩니다.
          </p>
        </div>
        <ZoneMap onSelect={handleMapSelect} selectedZoneId={form.zoneId} />
        {form.zoneId && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">선택된 구역:</span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
              {getZoneName(form.zoneId)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              form.projectType === "reconstruction"
                ? "bg-blue-100 text-blue-600"
                : "bg-green-100 text-green-600"
            }`}>
              {form.projectType === "reconstruction" ? "재건축" : "재개발"}
            </span>
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <form id="analysis-form" onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-zinc-900">사용자 입력값</h2>
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
              {dbZones.length === 0 && (
                <option value="">불러오는 중...</option>
              )}
              {(() => {
                const recons = dbZones.filter(z => z.project_type === "reconstruction");
                const redevs = dbZones.filter(z => z.project_type === "redevelopment");
                return (
                  <>
                    {recons.length > 0 && (
                      <optgroup label="✅ 재건축">
                        {recons.map(z => (
                          <option key={z.zone_id} value={z.zone_id}>
                            {z.zone_name ?? z.zone_id}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {redevs.length > 0 && (
                      <optgroup label="🔒 재개발 (준비중)">
                        {redevs.map(z => (
                          <option key={z.zone_id} value={z.zone_id} disabled>
                            {z.zone_name ?? z.zone_id} (준비중)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
            </select>
            <p className="text-xs text-zinc-400">
              총 {dbZones.filter(z => z.project_type === "reconstruction").length}개 재건축 구역 · DB 실시간 연동
            </p>
          </div>

          {/* 물건 유형 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">물건 유형</label>
            <select
              value={form.propertyType}
              disabled={form.projectType !== "reconstruction"}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-50 disabled:text-zinc-400"
            >
              {form.projectType === "reconstruction"
                ? <option value="apartment">아파트</option>
                : <>
                    <option value="villa">빌라 (준비중)</option>
                    <option value="house">단독주택 (준비중)</option>
                  </>
              }
            </select>
          </div>

          <NumberInput label="매수 희망가 (원)" value={form.purchasePrice} onChange={(v) => set("purchasePrice", v)} placeholder="예: 300000000" showWon />
          <NumberInput label="매수 시 대출금 (원)" value={form.purchaseLoanAmount} onChange={(v) => set("purchaseLoanAmount", v)} placeholder="예: 200000000" note="보유기간 이자 계산에 사용" showWon />
          <NumberInput label="현재 전/월세 보증금 (원)" value={form.currentDeposit} onChange={(v) => set("currentDeposit", v)} placeholder="예: 0 (거주 중이면 0)" showWon />

          {/* 희망 조합원 분양 평형 — 평형/㎡ 토글 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">희망 조합원 분양 평형</label>
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 text-xs">
                <button type="button"
                  onClick={() => setPyungUnit("pyung")}
                  className={`px-2.5 py-1 font-medium transition-colors ${pyungUnit === "pyung" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
                >평형</button>
                <button type="button"
                  onClick={() => setPyungUnit("sqm")}
                  className={`px-2.5 py-1 font-medium transition-colors ${pyungUnit === "sqm" ? "bg-blue-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
                >㎡</button>
              </div>
            </div>
            {pyungUnit === "pyung" ? (
              <input
                type="number"
                value={form.desiredPyung || ""}
                onChange={(e) => set("desiredPyung", Number(e.target.value))}
                placeholder="예: 59, 84"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type="number"
                value={sqmRaw}
                onChange={(e) => {
                  setSqmRaw(e.target.value);
                  const sqm = parseFloat(e.target.value);
                  if (sqm > 0) set("desiredPyung", Math.round(sqm / 3.3058 * 10) / 10);
                }}
                placeholder="예: 84.91 (84㎡ = 약 25.7평)"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {form.desiredPyung > 0 && (
              <p className="text-xs font-semibold text-blue-600">
                {pyungUnit === "sqm"
                  ? `≈ ${form.desiredPyung}평 (${(form.desiredPyung * 3.3058).toFixed(1)}㎡)`
                  : `≈ ${(form.desiredPyung * 3.3058).toFixed(1)}㎡`}
              </p>
            )}
          </div>

          <NumberInput label="공동주택 공시가격 (원)" value={form.officialValuation} onChange={(v) => set("officialValuation", v)} placeholder="비워두면 단지명으로 자동 조회" note="입력 시 우선 적용 · 미입력 시 NSDI 자동조회" showWon />

          {/* 재건축 전용: 대지지분 */}
          {form.projectType === "reconstruction" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">
                대지지분 (㎡)
                <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">재건축 핵심 지표</span>
              </label>
              <input
                type="number"
                value={form.landShareSqm || ""}
                onChange={(e) => set("landShareSqm", parseFloat(e.target.value) || 0)}
                placeholder="예: 16 (등기부등본 표제부 확인)"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-400">
                등기부등본 → 표제부 → 「대지권의 표시」에서 확인 (단위: ㎡)
              </p>
            </div>
          )}
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

        {form.projectType !== "reconstruction" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium">
            🔒 재개발 분석은 준비 중입니다. 재건축 구역을 선택해주세요.
          </div>
        )}
        <button
          type="submit"
          disabled={loading || form.projectType !== "reconstruction"}
          className="rounded-xl bg-blue-600 text-white font-bold py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          {loading ? "계산 중..." : "3가지 시나리오 분석 실행 →"}
        </button>
      </form>

      {/* 관리자 입력값 */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAdminOpen(v => !v)}
          className="w-full flex items-center justify-between px-8 py-4 hover:bg-amber-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">관리자 전용</span>
            <h2 className="font-bold text-zinc-900">관리자 입력값</h2>
            <span className="text-xs text-zinc-400">— 입력 시 DB 기본값 대신 적용</span>
          </div>
          <span className="text-zinc-400 text-sm">{adminOpen ? "▲ 접기" : "▼ 펼치기"}</span>
        </button>

        {adminOpen && (
          <div className="px-8 pb-8 flex flex-col gap-6 border-t border-amber-100">
            {(() => {
              const stage = dbZones.find(z => z.zone_id === form.zoneId)?.project_stage ?? "";
              // 단계 순서 (낮을수록 초기)
              const STAGE_ORDER: Record<string, number> = {
                zone_designation: 1, basic_plan: 2,
                project_implementation: 3,
                management_disposal: 4, relocation: 5,
                construction_start: 6, completion: 7,
              };
              const rank = STAGE_ORDER[stage] ?? 0;
              const atLeast = (s: string) => rank >= (STAGE_ORDER[s] ?? 99);

              const STAGE_LABEL: Record<string, string> = {
                zone_designation: "구역지정", basic_plan: "기본계획",
                project_implementation: "사업시행인가", management_disposal: "관리처분인가",
                relocation: "이주·철거", construction_start: "착공", completion: "준공",
              };

              function StageLock({ minStage }: { minStage: string }) {
                if (atLeast(minStage)) return null;
                return (
                  <p className="text-xs text-rose-500 mt-0.5 font-medium">
                    🔒 {STAGE_LABEL[minStage]} 이후 확인 가능
                  </p>
                );
              }

              return (
                <>
                  {/* 현재 단계 표시 */}
                  {stage && (
                    <div className="pt-5 flex items-center gap-2 text-sm">
                      <span className="text-zinc-400">현재 사업 단계:</span>
                      <span className="font-semibold text-zinc-800 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                        {STAGE_LABEL[stage] ?? stage}
                      </span>
                      <span className="text-xs text-zinc-400">— 잠긴 항목은 해당 단계가 되어야 확인 가능</span>
                    </div>
                  )}

                  {/* A. 항상 입력 가능 */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-bold text-zinc-700">A. 시세 · 토지대장 (항상 입력 가능)</p>
                      <p className="text-xs text-zinc-400 mt-0.5">네이버 부동산 · 정부24 토지대장에서 확인</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AdminInput
                        label="인근 신축 현재 시세 (원)"
                        note="희망 평형 기준 총액. 입주 후 예상 매도가"
                        placeholder="예: 600000000 (6억)"
                        value={form.admin?.neighborNewAptPrice}
                        onChange={v => setAdmin("neighborNewAptPrice", v)}
                      />
                      <AdminInput
                        label="개별공시지가 (원/㎡)"
                        note="정부24 → 토지대장. 대지지분과 곱해 토지 감정평가액 산출"
                        placeholder="예: 3500000 (350만/㎡)"
                        value={form.admin?.landOfficialPricePerSqm}
                        onChange={v => setAdmin("landOfficialPricePerSqm", v)}
                      />
                    </div>
                  </div>

                  {/* B. 사업시행인가 이후 */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className={`text-sm font-bold ${atLeast("project_implementation") ? "text-zinc-700" : "text-zinc-400"}`}>
                        B. 건축계획 (사업시행인가 이후)
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">사업시행계획서 → 건축계획에서 확인</p>
                      {!atLeast("project_implementation") && (
                        <p className="text-xs text-rose-500 mt-0.5 font-medium">🔒 사업시행인가 이후 확인 가능</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AdminInput
                        label="계획 총연면적 (㎡)"
                        note="사업시행계획서 → 건축계획 → 총연면적"
                        placeholder="예: 47000"
                        value={form.admin?.totalFloorArea}
                        onChange={v => setAdmin("totalFloorArea", v)}
                        disabled={!atLeast("project_implementation")}
                      />
                      <AdminInput
                        label="일반분양 면적 (㎡)"
                        note="없으면 0 입력"
                        placeholder="예: 0"
                        value={form.admin?.generalSaleArea}
                        onChange={v => setAdmin("generalSaleArea", v)}
                        disabled={!atLeast("project_implementation")}
                      />
                      <AdminInput
                        label="조합원분양 면적 (㎡)"
                        note="조합원분양 세대 × 평균전용면적"
                        placeholder="예: 25000"
                        value={form.admin?.memberSaleArea}
                        onChange={v => setAdmin("memberSaleArea", v)}
                        disabled={!atLeast("project_implementation")}
                      />
                      <AdminInput
                        label="예상 일반분양가 (원/평)"
                        note="HUG 분양가 상한제 또는 인근 분양 사례"
                        placeholder="예: 40000000 (4,000만)"
                        value={form.admin?.generalSalePricePerPyung}
                        onChange={v => setAdmin("generalSalePricePerPyung", v)}
                        disabled={!atLeast("project_implementation")}
                      />
                    </div>
                  </div>

                  {/* C. 관리처분인가 이후 */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className={`text-sm font-bold ${atLeast("management_disposal") ? "text-zinc-700" : "text-zinc-400"}`}>
                        C. 분담금 핵심값 (관리처분인가 이후) ⭐
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">관리처분계획서 → 분담금 기준표에서 확인. 이 두 값이 가장 중요</p>
                      {!atLeast("management_disposal") && (
                        <p className="text-xs text-rose-500 mt-0.5 font-medium">🔒 관리처분인가 이후 확인 가능 — 현재는 추정값으로 계산</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AdminInput
                        label="총종전자산 감정평가액 (원) ⭐"
                        note="관리처분계획서 → 분담금 기준표 → 총종전자산평가액 합계"
                        placeholder="예: 95000000000 (950억)"
                        value={form.admin?.totalAppraisalValue}
                        onChange={v => setAdmin("totalAppraisalValue", v)}
                        disabled={!atLeast("management_disposal")}
                      />
                      <AdminInput
                        label="조합원 분양가 (원/평) ⭐"
                        note="관리처분계획서 → 조합원분양가 또는 분양공고문"
                        placeholder="예: 35000000 (3,500만)"
                        value={form.admin?.memberSalePricePerPyung}
                        onChange={v => setAdmin("memberSalePricePerPyung", v)}
                        disabled={!atLeast("management_disposal")}
                      />
                      <div className="flex flex-col gap-1.5">
                        <label className={`text-sm font-medium ${atLeast("management_disposal") ? "text-zinc-700" : "text-zinc-400"}`}>
                          착공예정월 (YYYYMM)
                        </label>
                        <input
                          type="text"
                          value={form.admin?.constructionStartYm ?? ""}
                          onChange={e => setAdmin("constructionStartYm", e.target.value || undefined)}
                          disabled={!atLeast("management_disposal")}
                          placeholder="예: 202603"
                          maxLength={6}
                          className="border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-zinc-50"
                        />
                        <p className="text-xs text-zinc-400">조합 공문 또는 정비몽땅 공고</p>
                        <StageLock minStage="management_disposal" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700">
                    💡 비워둔 항목은 DB 기본값이 적용됩니다. C 섹션(총종전자산·조합원분양가)이 가장 정확도에 큰 영향을 줍니다.
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 결과 */}
      {result && (() => {
        const personalAppraisal = result.neutral.estimatedAppraisalValue;
        const desiredPyung = result.input.desiredPyung;
        const bn = result.neutral.calcBreakdown;
        const matrixData = DISCOUNT_RATES.map(d => ({
          d,
          opt:  computeMatrixCell(result.optimistic.calcBreakdown,  d, personalAppraisal, desiredPyung),
          neut: computeMatrixCell(result.neutral.calcBreakdown,     d, personalAppraisal, desiredPyung),
          pes:  computeMatrixCell(result.pessimistic.calcBreakdown, d, personalAppraisal, desiredPyung),
        }));

        return (
        <div className="flex flex-col gap-5">
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
              {/* 계산 경고 배너 */}
              {result.warnings.length > 0 && (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 flex flex-col gap-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800 font-medium">⚠️ {w}</p>
                  ))}
                </div>
              )}
              {/* 실거래가 미확인 경고 */}
              {!result.marketDataSources.nearbyNewAptFromApi && (
                <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
                  🚨 인근 신축 시세 조회 실패 — p_base/peak_local이 DB 기본값(서울 기준)으로 계산됨. 비례율 왜곡 가능성 높음.
                </div>
              )}
              {/* 🔍 디버그 패널 */}
              <details className="mt-2">
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600">🔍 계산 투입값 (디버그)</summary>
                <div className="mt-1 rounded-lg bg-zinc-50 border border-zinc-200 p-3 font-mono text-xs text-zinc-600 grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-zinc-400">lawd_cd (DB)</span><span className={result.debugParams.lawd_cd ? "text-zinc-800" : "text-red-500"}>{result.debugParams.lawd_cd ?? "null ❌"}</span>
                  <span className="text-zinc-400">bjd_code (DB)</span><span className={result.debugParams.bjd_code ? "text-zinc-800" : "text-red-500"}>{result.debugParams.bjd_code ?? "null ❌"}</span>
                  <span className="text-zinc-400">effectiveLawdCd</span><span className={result.debugParams.effectiveLawdCd ? "text-zinc-800" : "text-red-500"}>{result.debugParams.effectiveLawdCd ?? "null ❌"}</span>
                  <span className="text-zinc-400">existingUnits</span><span className={result.debugParams.existingUnits > 0 ? "text-zinc-800" : "text-red-500"}>{result.debugParams.existingUnits} {result.debugParams.existingUnits === 0 ? "❌ 추정 안 함" : "✓"}</span>
                  <span className="text-zinc-400">plannedUnitsMember</span><span>{result.debugParams.plannedUnitsMember ?? "null"}</span>
                  <span className="text-zinc-400">nearbyOk</span><span className={result.debugParams.nearbyOk ? "text-green-600" : "text-red-500"}>{result.debugParams.nearbyOk ? "✓ true" : "✗ false"}</span>
                  <span className="text-zinc-400">molitOk</span><span className={result.debugParams.molitOk ? "text-green-600" : "text-red-500"}>{result.debugParams.molitOk ? "✓ true" : "✗ false"}</span>
                  <span className="text-zinc-400">건축물대장</span><span className={result.debugParams.buildingFloorAreaFromApi ? "text-green-600" : "text-red-500"}>{result.debugParams.buildingFloorAreaFromApi ? `✓ ${result.debugParams.buildingFloorAreaRaw?.toLocaleString()}㎡ / 현용적률 ${result.debugParams.buildingFloorAreaFAR ?? "—"}%` : "✗ 조회 실패"}</span>
                  <span className="text-zinc-400">stageRank</span><span>{result.debugParams.projectStageRank}</span>
                  <span className="text-zinc-400">total_appraisal_value</span>
                  <span>
                    <span className="font-medium">{(result.debugParams.total_appraisal_value / 1e8).toFixed(1)}억</span>
                    <span className="ml-1 text-xs text-zinc-400">({result.debugParams.priorAssetMethodUsed})</span>
                    <span className="ml-2 text-xs space-x-2">
                      {result.debugParams.priorAssetMethod1 != null && (
                        <span className={result.debugParams.priorAssetMethodUsed === "method1" ? "text-green-600" : "text-zinc-400"}>
                          m1:{(result.debugParams.priorAssetMethod1 / 1e8).toFixed(1)}억
                        </span>
                      )}
                      {result.debugParams.priorAssetMethod2 != null && (
                        <span className={result.debugParams.priorAssetMethodUsed === "method2" ? "text-green-600" : "text-zinc-400"}>
                          m2:{(result.debugParams.priorAssetMethod2 / 1e8).toFixed(1)}억
                        </span>
                      )}
                      {result.debugParams.priorAssetMethod3 != null && (
                        <span className={result.debugParams.priorAssetMethodUsed === "method3" ? "text-green-600" : "text-zinc-400"}>
                          m3:{(result.debugParams.priorAssetMethod3 / 1e8).toFixed(1)}억
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-zinc-400">total_floor_area</span><span>{result.debugParams.total_floor_area.toLocaleString()}㎡</span>
                  <span className="text-zinc-400">member_sale_area</span>
                  <span className={result.debugParams.saleAreaSource === "calculated" ? "text-green-600" : result.debugParams.saleAreaSource === "missing" ? "text-red-500" : ""}>
                    {result.debugParams.saleAreaSource === "missing"
                      ? `✗ 필요: ${result.debugParams.missingSaleAreaFields.join(", ")}`
                      : `${result.debugParams.saleAreaSource === "calculated" ? "✓ " : ""}${result.debugParams.member_sale_area.toLocaleString()}㎡`}
                  </span>
                  <span className="text-zinc-400">general_sale_area</span>
                  <span className={result.debugParams.saleAreaSource === "calculated" ? "text-green-600" : result.debugParams.saleAreaSource === "missing" ? "text-red-500" : ""}>
                    {result.debugParams.saleAreaSource === "missing"
                      ? `✗ 필요: ${result.debugParams.missingSaleAreaFields.join(", ")}`
                      : `${result.debugParams.saleAreaSource === "calculated" ? "✓ " : ""}${result.debugParams.general_sale_area.toLocaleString()}㎡`}
                  </span>
                  <span className="text-zinc-400">p_base</span><span className={result.debugParams.p_base > 50_000_000 ? "text-red-500 font-bold" : "text-zinc-800"}>{(result.debugParams.p_base / 1e4).toFixed(0)}만/평 {result.debugParams.p_base > 50_000_000 ? "⚠️ 서울값?" : ""}</span>
                  <span className="text-zinc-400">member_sale_price</span><span className={result.debugParams.member_sale_price_per_pyung > 40_000_000 ? "text-red-500 font-bold" : "text-zinc-800"}>{(result.debugParams.member_sale_price_per_pyung / 1e4).toFixed(0)}만/평 {result.debugParams.member_sale_price_per_pyung > 40_000_000 ? "⚠️ 서울값?" : ""}</span>
                  <span className="text-zinc-400">peak_local</span><span>{(result.debugParams.peak_local / 1e4).toFixed(0)}만/평</span>
                  <span className="text-zinc-400">neighbor_new_apt</span><span>{(result.debugParams.neighbor_new_apt_price / 1e8).toFixed(2)}억</span>
                </div>
              </details>
              {/* 계산 과정 상세 (관리자용) */}
              <details className="mt-2">
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600">📐 계산 과정 상세 (중립 시나리오 기준)</summary>
                {(() => {
                  const b = result.neutral.calcBreakdown;
                  const fmt억 = (v: number) => `${(v / 1e8).toFixed(1)}억`;
                  const fmt만 = (v: number) => `${(v / 1e4).toFixed(0)}만`;
                  return (
                    <div className="mt-2 font-mono text-xs text-zinc-600 space-y-3">

                      {/* Step 1 */}
                      <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                        <div className="font-semibold text-zinc-700 mb-1">① 사업기간</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-zinc-400">착공까지</span><span>{b.monthsToStart}개월 ({(b.monthsToStart/12).toFixed(1)}년)</span>
                          <span className="text-zinc-400">공사기간</span><span>{b.constructionMonths}개월 ({(b.constructionMonths/12).toFixed(1)}년)</span>
                          <span className="text-zinc-400">총 T</span><span className="font-medium">{b.T}개월 ({(b.T/12).toFixed(1)}년)</span>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                        <div className="font-semibold text-zinc-700 mb-1">② 공사비 예측 (지수평활)</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-zinc-400">현재 C₀</span><span>{fmt만(b.C0)}/평</span>
                          <span className="text-zinc-400">감쇠계수 W</span><span>{b.W}</span>
                          <span className="text-zinc-400">적용 월 인상률</span><span>{(b.appliedMonthlyRate * 100).toFixed(3)}%</span>
                          <span className="text-zinc-400">착공시 C_T</span><span className="font-medium">{fmt만(b.C_T)}/평</span>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                        <div className="font-semibold text-zinc-700 mb-1">③ 총사업비</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {b.existingFloorAreaSqm != null && b.existingFAR != null && b.derivedSiteAreaSqm != null ? (<>
                            <span className="text-zinc-400 col-span-2 text-xs text-zinc-300">▸ 신축연면적 역산</span>
                            <span className="text-zinc-400 pl-2">기존연면적(건축물대장)</span><span>{b.existingFloorAreaSqm.toLocaleString()}㎡</span>
                            <span className="text-zinc-400 pl-2">기존용적률</span><span>{b.existingFAR}%</span>
                            <span className="text-zinc-400 pl-2">역산 대지면적</span><span>{b.derivedSiteAreaSqm.toLocaleString()}㎡</span>
                            <span className="text-zinc-400 pl-2">신축용적률</span><span>{b.newFAR}%</span>
                          </>) : null}
                          <span className="text-zinc-400">신축 총연면적</span><span>{b.totalFloorAreaPyung.toLocaleString()}평</span>
                          <span className="text-zinc-400">순수공사비 (C_T × 연면적)</span><span>{fmt억(b.pureCost)}</span>
                          <span className="text-zinc-400">기타사업비 (×33%)</span><span>{fmt억(b.otherCost)}</span>
                          <span className="text-zinc-400">금융비용</span><span>{fmt억(b.financialCost)}</span>
                          <span className="text-zinc-400 font-medium">총사업비</span><span className="font-medium">{fmt억(b.totalCost)}</span>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                        <div className="font-semibold text-zinc-700 mb-1">④ 총분양수익</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-zinc-400">일반분양가 P</span><span>{fmt만(b.P)}/평</span>
                          <span className="text-zinc-400">일반분양가 (P)</span><span>{b.P.toLocaleString()}원/평</span>
                          <span className="text-zinc-400">일반분양면적</span><span>{b.generalSaleAreaPyung.toLocaleString()}평</span>
                          <span className="text-zinc-400">일반분양수익</span><span>{fmt억(b.generalRevenue)}</span>
                          <span className="text-zinc-400">
                            조합원분양가
                            <span className="ml-1 text-xs px-1 rounded" style={{background: b.memberSalePriceMethod === 'prop_rate_inverse' ? '#dbeafe' : b.memberSalePriceMethod === 'announced' ? '#dcfce7' : '#fef9c3'}}>
                              {b.memberSalePriceMethod === 'prop_rate_inverse' ? '비례율역산' : b.memberSalePriceMethod === 'announced' ? '확정' : b.memberSalePriceMethod === 'manual' ? '수동' : '할인추정'}
                            </span>
                          </span>
                          <span>{b.memberSalePricePerPyung.toLocaleString()}원/평</span>
                          <span className="text-zinc-400">조합원분양면적</span><span>{b.memberSaleAreaPyung.toLocaleString()}평</span>
                          <span className="text-zinc-400">조합원분양수익</span><span>{fmt억(b.memberRevenue)}</span>
                          <span className="text-zinc-400 font-medium">총분양수익</span><span className="font-medium">{fmt억(b.totalRevenue)}</span>
                        </div>
                      </div>

                      {/* Step 5 */}
                      <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                        <div className="font-semibold text-zinc-700 mb-1">⑤ 비례율</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-zinc-400">총종전자산</span><span>{fmt억(b.totalAppraisalValue)}</span>
                          <span className="text-zinc-400">(총분양수익 - 총사업비)</span><span>{fmt억(b.totalRevenue - b.totalCost)}</span>
                          <span className="text-zinc-400 font-medium">비례율</span><span className="font-medium">{result.neutral.proportionalRate.toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Step 6 */}
                      <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                        <div className="font-semibold text-zinc-700 mb-1">⑥ 개인 감정평가 & 분담금</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-zinc-400">감정평가 방법</span><span>{b.appraisalMethodDetail}</span>
                          <span className="text-zinc-400">감정평가액</span><span>{fmt억(result.neutral.estimatedAppraisalValue)}</span>
                          <span className="text-zinc-400">권리가액 (×비례율)</span><span>{fmt억(result.neutral.rightsValue)}</span>
                          <span className="text-zinc-400">조합원분양가 총액</span><span>{fmt억(result.neutral.targetMemberSalePrice)}</span>
                          <span className="text-zinc-400 font-medium">추가분담금</span><span className="font-medium">{fmt억(result.neutral.additionalContribution)}</span>
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </details>

              {/* API 데이터 소스 배지 */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(
                  [
                    { label: "금리 (ECOS)", active: result.marketDataSources.ratesFromApi, note: null },
                    { label: "공사비지수 (KOSIS)", active: result.marketDataSources.constructionCostFromApi, note: "통계청 IP 제한 — 기본값 적용" },
                    { label: "실거래가 (국토부)", active: result.marketDataSources.localPriceFromApi, note: "lawd_cd 미설정 시 생략" },
                    { label: "인근 신축 시세", active: result.marketDataSources.nearbyNewAptFromApi, note: "lawd_cd 오류 시 실패" },
                    { label: "공시가격 (NSDI)", active: result.marketDataSources.publicPriceFromApi, note: "입력값 기반 추정" },
                  ] as const
                ).map(({ label, active, note }) => (
                  <span
                    key={label}
                    title={!active && note ? note : undefined}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-default ${
                      active
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {active ? "● " : "○ "}{label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── 핵심 매트릭스 ── */}
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900">할인율별 비례율 &amp; 추정분담금</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                일반분양가(중립 {(bn.P / 1e4).toFixed(0)}만/평) 대비 조합원분양가 할인율 6단계 × 경제 시나리오 3종
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* 비례율 표 */}
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">비례율 (%)</span>
                  <span className="text-xs text-zinc-400">중립 굵게 표시</span>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left px-3 py-2 text-zinc-400 font-medium w-14">할인율</th>
                      <th className="text-center px-3 py-2 text-blue-500 font-medium">낙관 📈</th>
                      <th className="text-center px-3 py-2 text-zinc-700 font-bold bg-zinc-50">중립 📊</th>
                      <th className="text-center px-3 py-2 text-red-400 font-medium">비관 📉</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.map(({ d, opt, neut, pes }) => (
                      <tr key={d} className="border-b border-zinc-50 last:border-0">
                        <td className="px-3 py-2 font-semibold text-zinc-500">{d}%</td>
                        <td className={`px-3 py-1.5 text-center ${propRateCls(opt.propRate)}`}>{opt.propRate.toFixed(1)}%</td>
                        <td className={`px-3 py-1.5 text-center bg-zinc-50 ${propRateCls(neut.propRate, true)}`}>{neut.propRate.toFixed(1)}%</td>
                        <td className={`px-3 py-1.5 text-center ${propRateCls(pes.propRate)}`}>{pes.propRate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex gap-3 text-xs">
                  <span className="text-blue-600">● ≥115%</span>
                  <span className="text-green-600">● ≥100%</span>
                  <span className="text-yellow-600">● ≥85%</span>
                  <span className="text-red-600">● &lt;85%</span>
                </div>
              </div>

              {/* 추정분담금 표 */}
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">추정 분담금 ({desiredPyung}평 기준)</span>
                  <span className="text-xs text-zinc-400">감정평가 {fWon(personalAppraisal, true)}</span>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left px-3 py-2 text-zinc-400 font-medium w-14">할인율</th>
                      <th className="text-center px-3 py-2 text-blue-500 font-medium">낙관 📈</th>
                      <th className="text-center px-3 py-2 text-zinc-700 font-bold bg-zinc-50">중립 📊</th>
                      <th className="text-center px-3 py-2 text-red-400 font-medium">비관 📉</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.map(({ d, opt, neut, pes }) => (
                      <tr key={d} className="border-b border-zinc-50 last:border-0">
                        <td className="px-3 py-2 font-semibold text-zinc-500">{d}%</td>
                        <td className={`px-3 py-1.5 text-center ${opt.contribution < 0 ? "text-blue-600" : "text-red-600"}`}>{fmtContrib(opt.contribution)}</td>
                        <td className={`px-3 py-1.5 text-center bg-zinc-50 font-bold ${neut.contribution < 0 ? "text-blue-700" : "text-red-700"}`}>{fmtContrib(neut.contribution)}</td>
                        <td className={`px-3 py-1.5 text-center ${pes.contribution < 0 ? "text-blue-600" : "text-red-600"}`}>{fmtContrib(pes.contribution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex gap-3 text-xs">
                  <span className="text-blue-600">● 수령 (환급)</span>
                  <span className="text-red-600">● 납부 (추가부담금)</span>
                </div>
              </div>

            </div>
          </div>

          {/* ── 계산 기초값 ── */}
          <details className="rounded-xl border border-zinc-200 overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 bg-zinc-50 cursor-pointer text-sm font-semibold text-zinc-700 hover:bg-zinc-100 list-none">
              <span>📊 계산 기초값 (중립 시나리오)</span>
              <span className="text-xs font-normal text-zinc-400">▸ 클릭</span>
            </summary>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                ["신축 총연면적", `${bn.totalFloorAreaPyung.toLocaleString()}평`],
                ["일반 분양면적", `${bn.generalSaleAreaPyung.toLocaleString()}평`],
                ["조합원 분양면적", `${bn.memberSaleAreaPyung.toLocaleString()}평`],
                ["일반분양가 (중립)", `${(bn.P / 1e4).toFixed(0)}만/평`],
                ["일반분양수익 (중립)", `${(bn.generalRevenue / 1e8).toFixed(1)}억`],
                ["총사업비 낙/중/비", `${(result.optimistic.calcBreakdown.totalCost/1e8).toFixed(0)} / ${(bn.totalCost/1e8).toFixed(0)} / ${(result.pessimistic.calcBreakdown.totalCost/1e8).toFixed(0)}억`],
                ["총종전자산", `${(bn.totalAppraisalValue / 1e8).toFixed(1)}억`],
                ["개인 감정평가액", fWon(personalAppraisal, true)],
                ["사업기간 (중립)", fMonth(bn.T)],
              ].map(([label, value]) => (
                <div key={label} className="rounded bg-zinc-50 border border-zinc-100 p-2 flex flex-col gap-0.5">
                  <span className="text-zinc-400">{label}</span>
                  <span className="font-semibold text-zinc-800">{value}</span>
                </div>
              ))}
            </div>
          </details>

          {/* ── 계산 과정 상세 ── */}
          <details className="rounded-xl border border-zinc-200 overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 bg-zinc-50 cursor-pointer text-sm font-semibold text-zinc-700 hover:bg-zinc-100 list-none">
              <span>📐 계산 과정 상세 (중립 시나리오)</span>
              <span className="text-xs font-normal text-zinc-400">▸ 클릭</span>
            </summary>
            {(() => {
              const b = result.neutral.calcBreakdown;
              const fmt억 = (v: number) => `${(v / 1e8).toFixed(1)}억`;
              const fmt만 = (v: number) => `${(v / 1e4).toFixed(0)}만`;
              return (
                <div className="p-4 font-mono text-xs text-zinc-600 space-y-3">
                  <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                    <div className="font-semibold text-zinc-700 mb-1">① 사업기간</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-zinc-400">착공까지</span><span>{b.monthsToStart}개월 ({(b.monthsToStart/12).toFixed(1)}년)</span>
                      <span className="text-zinc-400">공사기간</span><span>{b.constructionMonths}개월 ({(b.constructionMonths/12).toFixed(1)}년)</span>
                      <span className="text-zinc-400">총 T</span><span className="font-medium">{b.T}개월 ({(b.T/12).toFixed(1)}년)</span>
                    </div>
                  </div>
                  <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                    <div className="font-semibold text-zinc-700 mb-1">② 공사비 예측 (지수평활)</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-zinc-400">현재 C₀</span><span>{fmt만(b.C0)}/평</span>
                      <span className="text-zinc-400">감쇠계수 W</span><span>{b.W}</span>
                      <span className="text-zinc-400">적용 월 인상률</span><span>{(b.appliedMonthlyRate * 100).toFixed(3)}%</span>
                      <span className="text-zinc-400">착공시 C_T</span><span className="font-medium">{fmt만(b.C_T)}/평</span>
                    </div>
                  </div>
                  <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                    <div className="font-semibold text-zinc-700 mb-1">③ 총사업비</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {b.existingFloorAreaSqm != null && b.existingFAR != null && b.derivedSiteAreaSqm != null ? (<>
                        <span className="text-zinc-400 col-span-2 text-xs text-zinc-300">▸ 신축연면적 역산</span>
                        <span className="text-zinc-400 pl-2">기존연면적(건축물대장)</span><span>{b.existingFloorAreaSqm.toLocaleString()}㎡</span>
                        <span className="text-zinc-400 pl-2">기존용적률</span><span>{b.existingFAR}%</span>
                        <span className="text-zinc-400 pl-2">역산 대지면적</span><span>{b.derivedSiteAreaSqm.toLocaleString()}㎡</span>
                        <span className="text-zinc-400 pl-2">신축용적률</span><span>{b.newFAR}%</span>
                      </>) : null}
                      <span className="text-zinc-400">신축 총연면적</span><span>{b.totalFloorAreaPyung.toLocaleString()}평</span>
                      <span className="text-zinc-400">순수공사비 (C_T × 연면적)</span><span>{fmt억(b.pureCost)}</span>
                      <span className="text-zinc-400">기타사업비 (×33%)</span><span>{fmt억(b.otherCost)}</span>
                      <span className="text-zinc-400">금융비용</span><span>{fmt억(b.financialCost)}</span>
                      <span className="text-zinc-400 font-medium">총사업비</span><span className="font-medium">{fmt억(b.totalCost)}</span>
                    </div>
                  </div>
                  <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                    <div className="font-semibold text-zinc-700 mb-1">④ 일반분양수익 (고정)</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-zinc-400">일반분양가 P</span><span>{fmt만(b.P)}/평</span>
                      <span className="text-zinc-400">일반분양면적</span><span>{b.generalSaleAreaPyung.toLocaleString()}평</span>
                      <span className="text-zinc-400 font-medium">일반분양수익</span><span className="font-medium">{fmt억(b.generalRevenue)}</span>
                    </div>
                  </div>
                  <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                    <div className="font-semibold text-zinc-700 mb-1">⑤ 종전자산 & 비례율 기준선</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-zinc-400">총종전자산</span><span>{fmt억(b.totalAppraisalValue)}</span>
                      <span className="text-zinc-400">총사업비</span><span>{fmt억(b.totalCost)}</span>
                      <span className="text-zinc-400">일반분양수익</span><span>{fmt억(b.generalRevenue)}</span>
                      <span className="text-zinc-400 text-zinc-300">잉여 (일반수익 - 사업비)</span><span className={b.generalRevenue - b.totalCost >= 0 ? "text-blue-600" : "text-red-600"}>{fmt억(b.generalRevenue - b.totalCost)}</span>
                    </div>
                  </div>
                  <div className="rounded bg-zinc-50 border border-zinc-200 p-2">
                    <div className="font-semibold text-zinc-700 mb-1">⑥ 개인 감정평가 (기준)</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-zinc-400">감정평가 방법</span><span>{b.appraisalMethodDetail}</span>
                      <span className="text-zinc-400">감정평가액</span><span>{fmt억(result.neutral.estimatedAppraisalValue)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </details>

          {/* ── 경제 시나리오별 상세 ── */}
          <details className="rounded-xl border border-zinc-200 overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 bg-zinc-50 cursor-pointer text-sm font-semibold text-zinc-700 hover:bg-zinc-100 list-none">
              <span>📈 경제 시나리오별 상세 비교</span>
              <span className="text-xs font-normal text-zinc-400">▸ 클릭</span>
            </summary>
            <div className="p-4 flex flex-col gap-4">
              <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <ComparisonTable result={result} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ScenarioCard r={result.optimistic} desiredPyung={result.input.desiredPyung} />
                <ScenarioCard r={result.neutral} desiredPyung={result.input.desiredPyung} />
                <ScenarioCard r={result.pessimistic} desiredPyung={result.input.desiredPyung} />
              </div>
            </div>
          </details>

          {/* 공사비 방법론 */}
          <details className="rounded-xl border border-zinc-200 overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 bg-zinc-50 cursor-pointer text-sm font-semibold text-zinc-700 hover:bg-zinc-100 list-none">
              <span>📐 공사비 예측 방법론 (지수평활법)</span>
              <span className="text-xs font-normal text-zinc-400">▸ 클릭</span>
            </summary>
            <div className="px-5 py-4 flex flex-col gap-2 text-sm">
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
          </details>

          <p className="text-xs text-zinc-400 text-center">
            본 분석 결과는 내부 테스트용이며 실제 투자 결과를 보장하지 않습니다.
            구역 데이터는 공개 정보 기반 추정값으로 실제 서비스 전 정확한 값으로 교체 필요.
          </p>
        </div>
        );
      })()}
    </div>
  );
}

function formatWon(v: number): string {
  if (!v || v === 0) return "";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const eok = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  if (eok > 0 && man > 0) return `${sign}${eok}억 ${man}만원`;
  if (eok > 0) return `${sign}${eok}억원`;
  if (man > 0) return `${sign}${man}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

function NumberInput({
  label, value, onChange, placeholder, note, showWon,
}: {
  label: string; value: number; onChange: (v: number) => void;
  placeholder?: string; note?: string; showWon?: boolean;
}) {
  const formatted = showWon ? formatWon(value) : "";
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
      {formatted && (
        <p className="text-xs font-semibold text-blue-600">{formatted}</p>
      )}
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}

function AdminInput({
  label, value, onChange, placeholder, note, disabled,
}: {
  label: string; value: number | undefined; onChange: (v: number) => void;
  placeholder?: string; note?: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-sm font-medium ${disabled ? "text-zinc-400" : "text-zinc-700"}`}>{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-zinc-50"
      />
      {note && <p className="text-xs text-zinc-400">{note}</p>}
    </div>
  );
}

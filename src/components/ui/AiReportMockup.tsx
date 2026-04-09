export default function AiReportMockup() {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <span
          className="inline-block w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        <span className="text-blue-600 text-sm font-medium">데이터 분석 및 리스크 검증 완료</span>
      </div>

      {/* 심리적 훅 — 그라데이션 밖, 항상 노출 */}
      <div className="px-6 pt-5 pb-3 shrink-0">
        <p className="bg-yellow-100 border border-yellow-300 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 leading-snug">
          ⚠️ 최악의 시나리오 발생 시 수억 원의 자금이 묶일 수 있습니다. 본 매수에 극도로 주의를 요합니다.
        </p>
      </div>

      {/* Body — 이 영역이 그라데이션으로 페이드아웃 */}
      <div className="relative flex-1 overflow-hidden">
        <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed space-y-3">
          <p>
            대상 구역의 사업 시행 인가 현황, 시공사 컨소시엄 구성, 인근 분양가 추이 및 거시 금리
            환경을 종합적으로 분석하였습니다. 현재 조합이 제시한 분담금 추정치는 2022년 기준
            공사비 단가를 반영하고 있어 시장 현실과 괴리가 있습니다.
          </p>
          <p>
            시나리오 분석 결과, Base 시나리오 기준 예상 수익률은 연 6.2%로 양호하나,
            공사비 상승 및 분양가 하락이 동시에 발생하는 Worst 시나리오 하에서는 수익성이
            급격히 악화됩니다.
          </p>
          <p>
            유동성 리스크, 추가 분담금 콜 가능성, 사업 지연에 따른 기회비용을 감안할 때
            현 시점 매수는 보수적 관점에서 재검토가 필요합니다.
          </p>
          <div className="flex justify-end pt-1">
            <span className="-rotate-12 inline-block border-2 border-red-600 text-red-600 font-bold text-xs px-3 py-1 rounded opacity-80 tracking-wider">
              AI 검증 완료
            </span>
          </div>
        </div>

        {/* Gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: '65%', background: 'linear-gradient(to bottom, transparent, white 75%)' }}
        />

        {/* Lock CTA */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center px-4" style={{ height: '65%' }}>
          <a
            href="#waitlist"
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-slate-300 shadow-md text-slate-700 text-xs font-semibold hover:shadow-lg hover:border-slate-400 transition-all duration-150"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-slate-500 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            전체 리포트는 이메일 구독 후 확인 가능합니다
          </a>
        </div>
      </div>

      {/* Footer */}
      <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100 shrink-0">
        * 본 리포트는 참고용이며 투자 결정을 권유하지 않습니다.
      </p>
    </div>
  );
}

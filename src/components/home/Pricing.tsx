export default function Pricing() {
  return (
    <section id="pricing" className="bg-white border-t border-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-3">
          가격 안내
        </p>
        <h2 className="text-zinc-900 font-bold text-3xl sm:text-4xl leading-tight mb-4">
          단 한 번의 분석으로 수억 원을 지킵니다
        </h2>
        <p className="text-zinc-500 text-base mb-12">
          중개소 수수료 한 번이면 수십 번 이용 가능한 가격입니다.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-6">
          {/* 기본 리포트 */}
          <div className="flex-1 max-w-sm mx-auto sm:mx-0 rounded-2xl border border-zinc-200 p-8 text-left shadow-sm">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              기본
            </p>
            <p className="text-3xl font-bold text-zinc-900 mb-1">
              99,000<span className="text-lg font-normal text-zinc-500">원</span>
            </p>
            <p className="text-sm text-zinc-400 mb-6">구역 1개 기준 / 1회 분석</p>
            <ul className="text-sm text-zinc-600 space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                최악·보통·최상 3단계 수익 시나리오
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                최대 분담금 역산 리포트
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                AI 팩트체크 타당성 분석
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                PDF 리포트 다운로드
              </li>
            </ul>
            <div className="rounded-xl bg-zinc-100 text-zinc-400 text-center py-3 text-sm font-semibold cursor-default">
              출시 예정
            </div>
          </div>

          {/* 프리미엄 리포트 */}
          <div className="flex-1 max-w-sm mx-auto sm:mx-0 rounded-2xl border-2 border-blue-600 p-8 text-left shadow-md relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              추천
            </span>
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">
              프리미엄
            </p>
            <p className="text-3xl font-bold text-zinc-900 mb-1">
              199,000<span className="text-lg font-normal text-zinc-500">원</span>
            </p>
            <p className="text-sm text-zinc-400 mb-6">구역 3개까지 / 30일 내 재분석 포함</p>
            <ul className="text-sm text-zinc-600 space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                기본 플랜 전체 포함
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                구역 3개 동시 비교 분석
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                30일 내 시세 변동 재분석 1회
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">✓</span>
                이메일 상담 1회 포함
              </li>
            </ul>
            <div className="rounded-xl bg-zinc-100 text-zinc-400 text-center py-3 text-sm font-semibold cursor-default">
              출시 예정
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-400 mt-8">
          출시 전 사전 예약하시면 얼리버드 할인가로 이용하실 수 있습니다.
        </p>
      </div>
    </section>
  );
}

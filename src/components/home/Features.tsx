// kleo pattern: alternating white / tint-1 (#fafafa) sections
// Each section: label (blue) → h2 → subtitle → content

const features = [
  {
    tag: '분담금 역산 엔진',
    title: '최악을 가정한 보수적 시나리오 계산기',
    subtitle:
      '공사비 20~30% 초과, 금리 2%p 상승, 분양가 하락 — 최악의 조건에서 실제 부담해야 할 분담금을 역산합니다. 최악을 알아야 진짜 투자가 보입니다.',
    tint: false,
    visual: (
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden p-6">
        <div className="space-y-3">
          {[
            { label: '공사비 초과 (최악)', value: '+28%', bar: 'w-4/5', color: 'bg-red-400' },
            { label: '금리 상승폭', value: '+2.1%p', bar: 'w-3/5', color: 'bg-orange-400' },
            { label: '분양가 하락률', value: '-12%', bar: 'w-2/5', color: 'bg-yellow-400' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-zinc-600">{item.label}</span>
                <span className="font-semibold text-zinc-800">{item.value}</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full">
                <div className={`h-2 rounded-full ${item.bar} ${item.color}`} />
              </div>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between items-center">
            <span className="text-sm text-zinc-500">예상 추가 분담금</span>
            <span className="text-lg font-bold text-red-500">+8,400만원</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: '수익률 밴드',
    title: '3가지 차원의 미래 수익률 밴드(Band)',
    subtitle:
      '최상(강세장) · 보통(기준) · 최악(약세장)의 세 시나리오로 5년 후 예상 수익률 범위를 시각화합니다. 단 하나의 숫자가 아닌, 확률적 범위로 리스크를 직시하세요.',
    tint: true,
    visual: (
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden p-6">
        <div className="flex items-end justify-center gap-4 h-36">
          {[
            { label: '최악', value: '-8%', height: 'h-16', color: 'bg-red-100 border-red-200', text: 'text-red-500' },
            { label: '보통', value: '+24%', height: 'h-24', color: 'bg-blue-100 border-blue-200', text: 'text-blue-600' },
            { label: '최상', value: '+61%', height: 'h-36', color: 'bg-green-100 border-green-200', text: 'text-green-600' },
          ].map((bar) => (
            <div key={bar.label} className="flex flex-col items-center gap-2 flex-1">
              <span className={`text-sm font-bold ${bar.text}`}>{bar.value}</span>
              <div className={`w-full rounded-t-xl border ${bar.color} ${bar.height}`} />
              <span className="text-xs text-zinc-500">{bar.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 text-center mt-4">5년 후 예상 수익률 시나리오</p>
      </div>
    ),
  },
  {
    tag: 'AI 리포트',
    title: 'AI 투자 타당성 검증 리포트',
    subtitle:
      '계산된 수익률 밴드와 핵심 지표를 AI에게 전달하여 "이 매물이 지금 매수할 가치가 있는가?"에 대한 객관적 리포트를 생성합니다. 계산은 알고리즘이, 해석은 AI가 담당합니다.',
    tint: false,
    visual: (
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-xs text-zinc-400">AI 투자 타당성 리포트</span>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-blue-600 mt-0.5">▸</span>
            <p className="text-zinc-600 leading-relaxed">
              분석 결과, 해당 매물의 <strong className="text-zinc-800">보수적 시나리오</strong>에서 분담금 추가 부담이
              예상 범위를 초과할 가능성이 높습니다.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-600 mt-0.5">▸</span>
            <p className="text-zinc-600 leading-relaxed">
              현재 금리 수준과 인근 분양가 추세를 고려할 때,{' '}
              <strong className="text-zinc-800">매수 시점 재검토</strong>를 권고합니다.
            </p>
          </div>
          <div className="h-px bg-zinc-100 my-1" />
          <p className="text-xs text-zinc-400">* 본 리포트는 참고용이며 투자 결정을 권유하지 않습니다.</p>
        </div>
      </div>
    ),
  },
];

export default function Features() {
  return (
    <>
      {features.map((feature, idx) => (
        <section
          key={idx}
          className={feature.tint ? 'bg-[#fafafa]' : 'bg-white'}
        >
          <div className="max-w-5xl mx-auto px-6 py-20">
            {/* kleo pattern: label → h2 → subtitle → visual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Text side */}
              <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
                {/* Tag — kleo: v2-h4---1 + v2-blue-highlight */}
                <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-4">
                  {feature.tag}
                </p>
                {/* H2 — kleo: v2-h2---1 */}
                <h2 className="text-zinc-900 font-bold text-2xl sm:text-3xl leading-tight mb-5">
                  {feature.title}
                </h2>
                {/* Subtitle — kleo: v2-h3---1-modifier */}
                <p className="text-zinc-500 text-lg leading-relaxed">
                  {feature.subtitle}
                </p>
              </div>

              {/* Visual side */}
              <div className={idx % 2 === 1 ? 'lg:order-1' : ''}>
                {feature.visual}
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

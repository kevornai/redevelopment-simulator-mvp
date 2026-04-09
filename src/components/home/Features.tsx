import ScenarioChart from '@/components/ui/ScenarioChart';
import CostVolatilityPanel from '@/components/ui/CostVolatilityPanel';
import AiReportMockup from '@/components/ui/AiReportMockup';

const features = [
  {
    tag: '분담금 역산 엔진',
    title: '"내 돈은 최대 얼마까지 더 들어갈까?" 금리·공사비 반영 분담금 예측',
    subtitle: (
      <>
        고정된 과거의 조합 브리핑 자료를 맹신하지 마십시오. 현재 시장의 가장 큰 리스크인{' '}
        <strong className="font-semibold text-zinc-800">'평당 공사비 인상률'</strong>과 사업 지연에 따른{' '}
        <strong className="font-semibold text-zinc-800">'금융 비용(이자)'</strong>을 알고리즘에 대입하여,
        입주 시점까지 변동될 수 있는 예상 분담금의{' '}
        <strong className="font-semibold text-zinc-800">최대치(최악의 한계선)</strong>를 먼저 산출합니다.
      </>
    ),
    visual: <CostVolatilityPanel />,
  },
  {
    tag: '수익률 밴드',
    title: '"그래서 최종 수익은 어떻게 될까?" 최상·보통·최악 3단계 수익률 밴드',
    subtitle: (
      <>
        재개발 투자는 단일화된 확정 수익이 존재할 수 없습니다.{' '}
        <strong className="font-semibold text-zinc-800">시장 호황 및 사업 단축(Best)</strong>,{' '}
        <strong className="font-semibold text-zinc-800">현재 거시 경제 기조 유지(Base)</strong>,{' '}
        <strong className="font-semibold text-zinc-800">원자재 폭등 및 인허가 지연(Worst)</strong>이라는{' '}
        3가지 시나리오를 대입하여 미래 수익금의 스펙트럼을 수치로 시각화합니다.
      </>
    ),
    visual: <ScenarioChart />,
  },
  {
    tag: 'AI 리포트',
    title: '"지금 사도 될까?" 영업 논리가 철저히 배제된 AI 타당성 리포트',
    subtitle: (
      <>
        거래 성사가 목적인 시장에서는 아무도 리스크를 경고하지 않습니다.
        이해관계가 전혀 없는 AI가 앞서 계산된 시나리오 데이터를 바탕으로,{' '}
        <strong className="font-semibold text-zinc-800">투자자의 자본 방어</strong>에 초점을 맞춘
        냉혹한 타당성 검증 리포트를 발행합니다.
      </>
    ),
    visual: <AiReportMockup />,
  },
];

export default function Features() {
  return (
    <section className="bg-[#fafafa] border-t border-zinc-100">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-3">
            핵심 기능
          </p>
          <h2 className="text-zinc-900 font-bold text-3xl sm:text-4xl leading-tight">
            감에 의존하는 투자는 끝냈습니다
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex flex-col gap-4"
            >
              <div>
                <p className="text-blue-600 font-semibold text-xs tracking-wide uppercase mb-2">
                  {feature.tag}
                </p>
                <h3 className="text-zinc-900 font-bold text-lg leading-snug mb-3">
                  {feature.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  {feature.subtitle}
                </p>
              </div>

              <div className="mt-auto h-[380px]">
                {feature.visual}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

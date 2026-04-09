import ScenarioChart from '@/components/ui/ScenarioChart';
import CostVolatilityPanel from '@/components/ui/CostVolatilityPanel';
import AiReportMockup from '@/components/ui/AiReportMockup';

const features = [
  {
    tag: '분담금 역산 엔진',
    title: '"내 돈은 최대 얼마까지 더 들어갈까?" 금리·공사비 반영 분담금 예측',
    subtitle: (
      <>
        과거 기준의 장밋빛 사업 계획서를 맹신하지 마십시오.{' '}
        <strong className="font-semibold text-zinc-800">국토부 실거래가</strong>와{' '}
        <strong className="font-semibold text-zinc-800">최신 평당 공사비 인상률</strong>을 알고리즘에 강제 대입하여,
        사업 지연 및 물가 상승 시 감당해야 할{' '}
        <strong className="font-semibold text-zinc-800">'가장 보수적인 분담금 한계치'</strong>를 미리 계산해 드립니다.
      </>
    ),

    visual: <CostVolatilityPanel />,
  },
  {
    tag: '수익률 밴드',
    title: '"그래서 최종 수익은 어떻게 될까?" 최상·보통·최악 3단계 수익률 밴드',
    subtitle: (
      <>
        %로 표시되는 애매한 수익률에 속지 마십시오.{' '}
        <strong className="font-semibold text-zinc-800">[매수가 + 최악의 예상 분담금 + 사업 지연 이자]</strong>를
        모두 합산한{' '}
        <strong className="font-semibold text-zinc-800">'나의 최종 총 투자금'</strong>을 구하고,
        이를 주변 신축 아파트 시세와 비교하여{' '}
        <strong className="font-semibold text-zinc-800">지금 매수해도 안전한 구간인지</strong>{' '}
        직관적인 금액으로 증명합니다.
      </>
    ),
    visual: <ScenarioChart />,
  },
  {
    tag: 'AI 리포트',
    title: '"지금 사도 될까?" 영업 논리가 철저히 배제된 AI 타당성 리포트',
    subtitle: (
      <>
        거래 성사가 목적인 중개소 브리핑에는 필연적으로{' '}
        <strong className="font-semibold text-zinc-800">'최상의 시나리오'만</strong> 담깁니다.
        우리 서비스는 이해관계가 전혀 얽히지 않은 AI가 오직 데이터만을 바탕으로{' '}
        <strong className="font-semibold text-zinc-800">"현재가 매수 시 리스크가 큽니다"</strong>와 같은{' '}
        냉정한 <strong className="font-semibold text-zinc-800">팩트체크 리포트</strong>를 발행합니다.
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

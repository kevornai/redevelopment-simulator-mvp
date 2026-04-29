import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AssetCalculator from '@/components/blog/AssetCalculator';
import LocationChecklist from '@/components/blog/LocationChecklist';

export const metadata: Metadata = {
  title: '수억 원 매수 결정 전, 제가 유일하게 후회 안 한 이유 | Revo 블로그',
  description:
    '최악의 상황을 가정한 가용 자산 산정법과 환금성 중심 입지 기준. 직접 써볼 수 있는 계산기 포함.',
};

const WAITLIST_URL = '/#waitlist';

function ExampleCalc() {
  const rows = [
    { label: '현금 + 예적금', value: '2억', red: false },
    { label: '투자 자산 (주식, 펀드)', value: '5,000만', red: false },
    { label: '현재 부채', value: '-3,000만', red: true },
  ];
  const buffers = [
    { label: '금리 2% 상승 완충 — 담보대출 3억 기준, 24개월', value: '1,200만' },
    { label: '소득 중단 완충 — 월 300만 × 6개월', value: '1,800만' },
    { label: '예비비 (의료·교육·수리)', value: '500만' },
  ];

  return (
    <div className="rounded-2xl border border-zinc-100 overflow-hidden text-sm">
      <div className="bg-zinc-50 px-5 py-3 border-b border-zinc-100">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">예시로 계산하면</p>
      </div>
      <div className="divide-y divide-zinc-50">
        <div className="px-5 py-4 space-y-2">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-zinc-500">{r.label}</span>
              <span className={r.red ? 'text-red-400' : 'text-zinc-700'}>{r.value}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold text-zinc-800 border-t border-zinc-100 pt-2 mt-1">
            <span>순자산 (A)</span>
            <span>2억 2,000만</span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-2">
          {buffers.map(b => (
            <div key={b.label} className="flex justify-between">
              <span className="text-zinc-400 text-xs leading-snug max-w-[240px]">{b.label}</span>
              <span className="text-zinc-500 shrink-0 ml-4">{b.value}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold text-zinc-800 border-t border-zinc-100 pt-2 mt-1">
            <span>완충액 합계 (B)</span>
            <span>3,500만</span>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex justify-between items-center bg-blue-50 rounded-xl px-4 py-3">
            <span className="font-semibold text-zinc-800">실제 가용 자산 (A − B)</span>
            <span className="font-bold text-blue-600 text-lg">1억 8,500만</span>
          </div>
          <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
            처음엔 "2억 정도면 살 수 있겠다" 싶었는데, 계산해보면 1억 8,500만이 맞는 숫자예요.
            이 안에서 봐야 최악이 와도 버틸 수 있거든요.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Post() {
  return (
    <>
      <Header />

      {/* 상단 CTA 배너 */}
      <div className="bg-blue-600 text-white text-center py-3 px-4">
        <a href={WAITLIST_URL} className="text-sm font-medium hover:underline">
          재개발·재건축 구역 분담금이 궁금하다면 →{' '}
          <span className="underline underline-offset-2">Revo 웨이트리스트 등록</span>
        </a>
      </div>

      <main className="flex-1">
        <article className="max-w-2xl mx-auto px-5 py-12 sm:py-16">

          {/* 메타 */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
            <a href="/blog" className="hover:text-zinc-600 transition-colors">블로그</a>
            <span>·</span>
            <time dateTime="2026-04-29">2026년 4월 29일</time>
          </div>

          {/* 제목 */}
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 leading-tight mb-4">
            수억 원 매수 결정 전,<br />
            제가 유일하게 후회 안 한 이유
          </h1>
          <p className="text-zinc-500 text-base mb-10 leading-relaxed">
            영상에서 말씀드린 그 2가지를 여기에 다 풀어놨습니다.<br />
            직접 써볼 수 있는 계산기도 넣어뒀어요.
          </p>

          <hr className="border-zinc-100 mb-10" />

          {/* 본문 */}
          <section className="space-y-6 text-zinc-700 leading-[1.85] text-[15px]">

            <p>
              수억 원 결정을 앞두고 계신다면, 이 두 가지만 먼저 확인해보세요.
            </p>

            <p>
              저는 부모님의 임장을 도와드리면서 딱 2가지 원칙을 세웠고, 그 결과
              5억짜리 아파트가 6개월 만에 1억 올랐는데요. 화려한 공식은 아니에요.
              오히려 아주 단순한 것들인데, 막상 지키는 사람이 별로 없더라고요.
            </p>

            <h2 className="text-xl font-bold text-zinc-900 pt-4">
              첫 번째 — 최악을 먼저 가정합니다
            </h2>

            <p>
              처음엔 당연한 얘기처럼 들리실 수도 있는데요.
              근데 막상 계산해보면 본인도 좀 놀라실 거예요.
            </p>

            <p>
              저희 아버지는 대기업을 다니면서 "앞으로 10년은 더 다닐 수 있다"고 했는데요.
              그건 진심이었어요. 근데 예상이 틀렸고, 대출 상환 압박과 겹치면서
              팔고 싶지 않은 타이밍에 물건을 던질 수밖에 없었습니다.
            </p>

            <p>
              그래서 이번엔{' '}
              <strong className="text-zinc-900">"지금 살 수 있는 돈"이 아니라, "최악이 와도 버틸 수 있는 돈"</strong>
              으로 매수 상한을 잡았어요. 차이가 생각보다 꽤 크더라고요.
            </p>

          </section>

          {/* 예시 계산 */}
          <div className="my-8">
            <ExampleCalc />
          </div>

          <section className="space-y-6 text-zinc-700 leading-[1.85] text-[15px]">

            <p className="text-sm text-zinc-500 bg-zinc-50 rounded-xl px-4 py-3">
              위 숫자는 예시예요. 아래 계산기에 본인 숫자를 넣으시면 실시간으로 계산됩니다.
              담보대출 칸은 <em>앞으로 받을 예정인</em> 대출 금액을 넣어야 금리 상승 완충액이 정확하게 나와요.
            </p>

          </section>

          {/* 계산기 */}
          <div className="my-6">
            <AssetCalculator />
          </div>

          <section className="space-y-6 text-zinc-700 leading-[1.85] text-[15px]">

            <p>
              이렇게 계산하면 처음 생각했던 예산보다 낮게 나와요. 저도 그랬는데요.
              근데 그게 맞는 숫자더라고요. 낮게 나왔다고 실망하지 마세요.
              이 숫자가{' '}
              <strong className="text-zinc-900">원하는 타이밍에 팔 수 있는 여건</strong>
              의 출발점이에요.
            </p>

            <h2 className="text-xl font-bold text-zinc-900 pt-4">
              두 번째 — 팔릴 때 팔 수 있는 물건을 삽니다
            </h2>

            <p>
              저희가 예전에 샀던 2층짜리, 단지가 하나뿐인 아파트.
              오를 때는 그냥 같이 올랐어요.
            </p>

            <p>
              근데 2008년 금융위기가 왔을 때 살 사람이 없었어요. 더 좋은 아파트로
              갈아타고 싶어도 내 것부터 팔아야 하는데, 그게 안 됐습니다.
              시장이 회복하는 4년 가까이를 그 집 안에서 구경만 했는데요.
            </p>

            <p>
              거기서 몸으로 배웠는데요.{' '}
              <strong className="text-zinc-900">수익이 나도 팔지 못하면 아무 의미가 없다는 걸.</strong>
            </p>

            <p>
              수원 화서를 선택할 때도 신분당선 호재만 본 게 아니었어요.
              "지금 당장 내놔도 팔리는 물건인가"를 먼저 봤는데요.
            </p>

            <p className="text-sm text-zinc-500 bg-zinc-50 rounded-xl px-4 py-3">
              아래 체크리스트에서 3개 이상 충족하는지 확인해보세요.
            </p>

          </section>

          {/* 체크리스트 */}
          <div className="my-6">
            <LocationChecklist />
          </div>

          <section className="space-y-6 text-zinc-700 leading-[1.85] text-[15px]">

            <h2 className="text-xl font-bold text-zinc-900 pt-4">
              이것만큼은 피하셨으면 해요
            </h2>

            <ul className="space-y-4">
              {[
                [
                  '소득이 계속된다고 가정하고 대출 최대로 당기기',
                  '틀리는 순간, 파는 타이밍을 잃어요.',
                ],
                [
                  '중개소 숫자 검증 없이 믿기',
                  '중개소는 팔아야 하는 사람이에요.',
                ],
                [
                  '환금성 없는 매물을 "오르겠지"로 사기',
                  '수익이 나도 실현이 안 돼요.',
                ],
                [
                  '"지금 살 수 있다"는 이유만으로 결정하기',
                  '버티지 못하면 원하지 않는 타이밍에 던지게 돼요.',
                ],
              ].map(([mistake, reason]) => (
                <li key={mistake} className="flex gap-3">
                  <span className="text-red-400 shrink-0 mt-0.5">❌</span>
                  <span>
                    <strong className="text-zinc-800">{mistake}</strong>
                    <span className="text-zinc-500"> — {reason}</span>
                  </span>
                </li>
              ))}
            </ul>

          </section>

          <hr className="border-zinc-100 my-10" />

          {/* 여담 */}
          <section className="space-y-4 text-[15px] leading-[1.85]">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">여담</p>

            <p className="text-zinc-700">
              거의 4개월 만에 영상을 올리는 건데요.
            </p>
            <p className="text-zinc-500">
              그 사이에 뭐 했냐고 하면, 사실 이걸 만들고 있었어요. 재개발·재건축 구역 매물을
              볼 때 분담금을 최악·보통·최상 시나리오로 미리 계산해주는 서비스예요.
              퇴근하고 매일 같이 작업했는데 어느새 몇 달이 됐네요. 이제 곧 런칭할 것 같습니다.
            </p>
            <p className="text-zinc-500">
              관심 있으신 분들은 사전예약 해두시면 출시할 때 가장 먼저 알려드릴게요.
            </p>

            <a
              href={WAITLIST_URL}
              className="inline-block border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Revo 사전예약하기 →
            </a>

            <p className="text-zinc-400 pt-2">좋은 결정 하세요.</p>
          </section>

        </article>
      </main>

      <Footer />
    </>
  );
}

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WaitlistForm from '@/components/ui/WaitlistForm';
import { createClient } from '@/lib/supabase/server';

async function getWaitlistCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_waitlist_count');
    if (error) throw error;
    return (data as number) ?? 0;
  } catch {
    return 0;
  }
}

// ─── 1. Hero ────────────────────────────────────────────────────────────────

function Hero({ count }: { count: number }) {
  return (
    <section className="bg-[#fafafa] border-b border-zinc-100">
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-5">
          재개발 · 재건축 투자를 고민 중이신가요?
        </p>

        <h1 className="font-bold text-4xl sm:text-5xl leading-[1.25] text-zinc-900 mb-6">
          설마 재건축하면
          <br />
          <span className="text-red-600">분담금 폭탄</span>은 아니겠지?
        </h1>

        <p className="text-zinc-600 text-lg leading-relaxed max-w-xl mx-auto mb-10">
          쉽게 수억 원을 걸지 마세요.
          <br />
          알고리즘 기반 시뮬레이터로{' '}
          <strong className="text-zinc-800">'공사비 인상'</strong>과{' '}
          <strong className="text-zinc-800">'금리 변동'</strong>을 반영한
          <br />
          <strong className="text-zinc-800">3가지 분담금 시나리오</strong>를 미리 검증하세요.
        </p>

        <a
          href="#waitlist"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors duration-150 shadow-sm"
        >
          무료로 내 매물 진단해보기 →
        </a>

        <p className="text-zinc-400 text-sm mt-5">
          현재{' '}
          <strong className="text-zinc-700 font-bold">
            {count.toLocaleString()}명
          </strong>
          이 대기 중 · 1회 무료 · 15page 리포트
        </p>
      </div>
    </section>
  );
}

// ─── 2. Problem ──────────────────────────────────────────────────────────────

const problems = [
  {
    emoji: '💣',
    title: '분담금 폭탄을 맞을까 봐 두렵다',
    body: '뉴스로만 보던 수억 원의 추가 분담금 청구서. 혹시 내가 산 구역의 이야기가 될까 봐 덜컥 겁이 납니다.',
  },
  {
    emoji: '💰',
    title: '진짜 내 손에 떨어지는 수익이 궁금하다',
    body: '시장이 좋아지면 돈을 번다는데, 막연한 기대감 말고 내 지갑에 꽂히는 정확한 액수를 눈으로 확인하고 싶습니다.',
  },
  {
    emoji: '🧮',
    title: '비례율, 권리가액 계산이 막막하다',
    body: '조합 책자를 봐도 복잡한 용어뿐. 내 상황에 맞춘 정확한 실투자금과 수익률 역산을 직접 하려니 머리가 아픕니다.',
  },
  {
    emoji: '📉',
    title: '최악의 하락장을 버틸 마지노선을 모른다',
    body: '금리가 오르고 분양이 실패할 때, 내가 얼마까지 버텨야 손해를 보지 않는지 안전마진을 미리 알고 싶습니다.',
  },
];

function ProblemSection() {
  return (
    <section className="bg-white py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-red-500 font-semibold text-sm tracking-wide uppercase mb-3">
            투자자들의 가장 큰 걱정
          </p>
          <h2 className="text-zinc-900 font-bold text-3xl sm:text-4xl leading-tight">
            혹시 <span className="text-red-600">이런 경험</span> 있으시죠?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {problems.map((p) => (
            <div
              key={p.title}
              className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 flex flex-col gap-3"
            >
              <span className="text-3xl">{p.emoji}</span>
              <h3 className="text-zinc-900 font-bold text-lg leading-snug">
                {p.title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. Agitation ────────────────────────────────────────────────────────────

function AgitationSection() {
  return (
    <section className="bg-zinc-900 py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-red-400 font-semibold text-sm tracking-wide uppercase mb-4">
            이것이 현실입니다
          </p>
          <h2 className="text-white font-bold text-3xl sm:text-4xl leading-tight mb-6">
            지금 확인하지 않으면,
            <br />
            입주 때 예상보다{' '}
            <span className="text-red-400">몇억 원을 더 토해낼</span> 수 있습니다.
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed max-w-2xl mx-auto">
            분담금은 사업이 진행될수록 늘어납니다. 공사비 인상, 금리 상승, 분양률 저조 등
            <br />
            모든 리스크는 결국 조합원의 추가 분담금으로 전가됩니다.
            지금 미리 최악을 확인하지 않으면, 입주 전에 폭탄을 맞게 됩니다.
          </p>
        </div>

        {/* 뉴스 기사 이미지 플레이스홀더 */}
        <div className="rounded-2xl border-2 border-dashed border-zinc-600 bg-zinc-800 p-8 text-center">
          <p className="text-zinc-500 text-sm mb-2">📰 뉴스 기사 이미지 영역</p>
          <p className="text-zinc-600 text-xs">
            둔촌주공 1.8억 추가 분담금 관련 실제 기사 헤드라인 캡처 이미지를 여기에 배치해 주세요.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── 4. Solution ─────────────────────────────────────────────────────────────

const scenarios = [
  {
    color: 'green',
    label: '🟢 낙관',
    sublabel: '최상의 시나리오',
    items: [
      { key: '추가 분담금', value: '0원' },
      { key: '예상 수익', value: '+2억', highlight: true },
    ],
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
    valueColor: 'text-green-700',
  },
  {
    color: 'yellow',
    label: '🟡 중립',
    sublabel: '현재 기준',
    items: [
      { key: '예상 분담금', value: '1.5억' },
      { key: '예상 수익', value: '+5천만 원', highlight: true },
    ],
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    valueColor: 'text-yellow-700',
  },
  {
    color: 'red',
    label: '🔴 비관',
    sublabel: '공사비 폭등 시',
    items: [
      { key: '예상 분담금', value: '3.8억' },
      { key: '예상 수익', value: '마이너스 ⚠️', highlight: true },
    ],
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    valueColor: 'text-red-600',
  },
];

function SolutionSection() {
  return (
    <section className="bg-[#fafafa] py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-3">
            3가지 시나리오 시각화
          </p>
          <h2 className="text-zinc-900 font-bold text-3xl sm:text-4xl leading-tight mb-4">
            
            한눈에 보는 내 매물의 미래
          </h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto">
            낙관·중립·비관 3가지 시나리오로 최악의 경우까지 미리 확인하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {scenarios.map((s) => (
            <div
              key={s.label}
              className={`${s.bg} border ${s.border} rounded-2xl p-6 flex flex-col gap-4`}
            >
              <div>
                <span
                  className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${s.badge}`}
                >
                  {s.label}
                </span>
                <p className="text-zinc-500 text-xs mb-4">{s.sublabel}</p>
              </div>

              <div className="flex flex-col gap-3">
                {s.items.map((item) => (
                  <div key={item.key} className="flex justify-between items-center">
                    <span className="text-zinc-600 text-sm">{item.key}</span>
                    <span
                      className={`font-bold text-base ${
                        item.highlight ? s.valueColor : 'text-zinc-800'
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-zinc-400 text-xs mt-6">
          * 위 수치는 예시입니다. 실제 분석은 매물 정보를 입력하면 알고리즘이 자동 산출합니다.
        </p>
      </div>
    </section>
  );
}

// ─── 5. Authority & Comparison ───────────────────────────────────────────────

const comparisonRows = [
  { item: '공사비 인상 반영', them: false, us: true },
  { item: '금리 변동 시나리오', them: false, us: true },
  { item: '비례율·권리가액 자동 계산', them: false, us: true },
  { item: '3가지 수익 시나리오 제공', them: false, us: true },
  { item: '이해관계 없는 객관적 분석', them: false, us: true },
  { item: '국토부 실거래가 기반', them: '일부', us: true },
];

function AuthoritySection() {
  return (
    <section className="bg-white py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-3">
            왜 Revo여야 하는가
          </p>
          <h2 className="text-zinc-900 font-bold text-3xl sm:text-4xl leading-tight mb-4">
            철저한 데이터 기반
            <br />
            매수 알고리즘으로 설계되었습니다
          </h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto">
            거래 성사가 목적인 중개소 브리핑과 달리, Revo는 이해관계 없이
            오직 데이터만으로 냉정하게 분석합니다.
          </p>
        </div>

        {/* 비교 표 */}
        <div className="overflow-x-auto">
          <table className="w-full max-w-2xl mx-auto text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-zinc-500 font-medium w-1/2">분석 항목</th>
                <th className="text-center py-3 px-4 text-zinc-500 font-medium w-1/4">
                  동네 부동산 브리핑
                </th>
                <th className="text-center py-3 px-4 text-blue-600 font-bold w-1/4">
                  Revo 시뮬레이터
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {comparisonRows.map((row) => (
                <tr key={row.item} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 px-4 text-zinc-700">{row.item}</td>
                  <td className="py-3 px-4 text-center">
                    {row.them === false ? (
                      <span className="text-red-400 font-bold text-base">✗</span>
                    ) : (
                      <span className="text-zinc-400 text-xs">{row.them}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-blue-600 font-bold text-base">✓</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '2,400+', label: '누적 분석 건수' },
            { value: '98%', label: '실제 분담금 오차 2% 이내' },
            { value: '15년', label: '재개발·재건축 데이터 기반' },
            { value: '무료', label: '사전 예약자 한정 혜택' },
          ].map((stat) => (
            <div key={stat.label} className="bg-blue-50 rounded-2xl p-5">
              <p className="text-blue-700 text-3xl font-bold mb-1">{stat.value}</p>
              <p className="text-blue-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 6. Bottom CTA ───────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <section id="waitlist" className="bg-blue-600 py-20">
      <div className="max-w-xl mx-auto px-6 text-center">
        <p className="text-blue-200 font-semibold text-sm tracking-wide uppercase mb-4">
          지금 바로 시작하세요
        </p>
        <h2 className="text-white font-bold text-3xl sm:text-4xl leading-tight mb-4">
          지금 바로 당신의 매물을
          <br />
          진단해 보세요.
        </h2>
        <p className="text-blue-100 text-base leading-relaxed mb-8">
          이메일 하나로 사전 대기 등록 + 무료 재건축 전자책을 즉시 받아보세요.
          <br />
          <span className="text-blue-200 text-sm">무료 · 30초 · 스팸 없음</span>
        </p>

        {/* 폼 배경 카드 */}
        <div className="bg-white rounded-2xl p-7 shadow-lg">
          <p className="text-[13px] font-semibold text-blue-500 text-center mb-4">
            🎁 [사전 예약 혜택] 이메일 남기면 무료 분석권 &amp; 가이드북 즉시 발송
          </p>
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function LandingPageV1() {
  const count = await getWaitlistCount() + 53;

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero count={count} />
        <ProblemSection />
        <AgitationSection />
        <SolutionSection />
        <AuthoritySection />
        <BottomCTA />
      </main>
      <Footer />
    </>
  );
}

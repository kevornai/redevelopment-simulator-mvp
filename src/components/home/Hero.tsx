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

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-500">
      <path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-zinc-200 text-zinc-600 text-sm hover:border-zinc-300 hover:text-zinc-800 transition-colors duration-150 cursor-default select-none shadow-sm">
      <span>{icon}</span>
      {label}
    </span>
  );
}

export default async function Hero() {
  const count = await getWaitlistCount() + 53;

  return (
    <section
      id="waitlist"
      className="bg-[#fafafa]"
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
      }}
    >
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="flex justify-center mb-4">
          <SparkleIcon />
        </div>

        <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase mb-5">
          재개발/재건축 투자를 고민 중이신가요?
        </p>

        <div className="max-w-2xl mx-auto mb-5">
          <h1 className="font-bold text-4xl sm:text-5xl leading-[1.2] text-zinc-900">
            당신이 사려는 매물
            <br />
            5년 뒤 <span className="text-blue-600">수익</span> or
            
            <span className="text-red-600"> 분담금 폭탄</span>
          </h1>
        </div>

        <div className="max-w-xl mx-auto mb-10">
          <p className="text-gray-900 text-lg leading-relaxed">
            중개소의 브리핑에 수억 원을 걸지 마세요.
            <br />
            알고리즘 기반 시뮬레이터로 <strong className="font-semibold">'공사비 인상'</strong>과{' '}
            <strong className="font-semibold">'금리 변동'</strong>등을 반영한
            <br />
            <strong className="font-semibold">3가지 미래 수익 시나리오</strong>를
            미리 돌려보고 검증하세요.
          </p>
        </div>

        <div className="max-w-[400px] mx-auto">
          {/* Micro-copy */}
          <p className="text-[13px] font-semibold text-blue-500 text-center mb-3">
            <span className="hidden sm:inline">🎁 [사전 예약 혜택] 지금 이메일 남기면, 무료 분석권 &amp; 가이드북 즉시 발송</span>
            <span className="inline sm:hidden">🎁 이메일 남기면 무료 분석권 &amp; 가이드북 발송</span>
          </p>
          <div className="mb-5">
            <WaitlistForm />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Chip icon="📊" label="보수적 시나리오 분석" />
          <Chip icon="📈" label="3가지 수익률 밴드" />
          <Chip icon="🤖" label="AI 타당성 리포트" />
          <Chip icon="📖" label="무료 가이드북" />
        </div>
      </div>

      {/* Social proof row */}
      <div className="border-t border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center">
          <p className="text-zinc-600 text-base">
            현재{' '}
            <strong className="text-zinc-900 text-2xl font-bold">
              {count.toLocaleString()}명
            </strong>
            이 리포트를 받기 위해 대기 중
          </p>
        </div>
      </div>
    </section>
  );
}

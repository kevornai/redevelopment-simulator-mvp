import WaitlistForm from '@/components/ui/WaitlistForm';
import { createClient } from '@/lib/supabase/server';

async function getWaitlistCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    return count ?? 0;
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
  const count = await getWaitlistCount();

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
            5년 뒤 <span className="text-blue-600">'수익'</span>이 될까요?
            <br />
            <span className="text-blue-600">'분담금 폭탄'</span>이 될까요?
          </h1>
        </div>

        <div className="max-w-xl mx-auto mb-10">
          <p className="text-zinc-500 text-lg leading-relaxed">
            중개소의 브리핑에 수억 원을 걸지 마세요.
            <br />
            알고리즘 기반 시뮬레이터로 <strong className="text-zinc-800 font-semibold">'공사비 인상'</strong>과{' '}
            <strong className="text-zinc-800 font-semibold">'금리 변동'</strong>등을 반영한
            <br />
            <strong className="text-zinc-800 font-semibold">3가지 미래 수익 시나리오</strong>를
            미리 돌려보고 검증하세요.
          </p>
        </div>

        <div className="max-w-lg mx-auto mb-5">
          <WaitlistForm />
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
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-center gap-6 text-sm text-zinc-500">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['bg-blue-200', 'bg-purple-200', 'bg-pink-200', 'bg-yellow-200', 'bg-green-200'].map(
                (color, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${color} border-2 border-white flex items-center justify-center text-xs font-bold text-zinc-500`}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                )
              )}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3.5 h-3.5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span>
                <strong className="text-zinc-700">{count.toLocaleString()}명</strong>이 리포트를 받기 위해 대기 중
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

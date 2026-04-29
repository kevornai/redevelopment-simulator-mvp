import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Revo 블로그 — 재개발·재건축 투자 실용 가이드',
  description: '분담금, 입지, 사업성 분석까지. 수억 원 결정 전에 읽어야 할 글들.',
};

const POSTS = [
  {
    id: 1,
    title: '수억 원 매수 결정 전, 제가 유일하게 후회 안 한 이유',
    description:
      '최악의 상황을 가정한 가용 자산 산정법과 환금성 중심 입지 기준. 직접 써볼 수 있는 계산기 포함.',
    date: '2026년 4월 29일',
    tag: '투자 원칙',
  },
];

export default function BlogIndex() {
  return (
    <>
      <Header />
      <main className="flex-1">

        {/* 히어로 */}
        <section className="border-b border-zinc-100 py-14 px-5">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Revo 블로그</p>
            <h1 className="text-3xl font-bold text-zinc-900 mb-3">
              재개발·재건축 투자,<br />데이터로 검증합니다
            </h1>
            <p className="text-zinc-500 text-base">
              중개소 브리핑이 아닌 숫자로. 수억 원 결정 전에 읽어야 할 글들을 씁니다.
            </p>
          </div>
        </section>

        {/* 포스트 목록 */}
        <section className="max-w-2xl mx-auto px-5 py-12 space-y-6">
          {POSTS.map(post => (
            <a
              key={post.id}
              href={`/blog/${post.id}`}
              className="group block border border-zinc-100 rounded-2xl p-6 hover:border-zinc-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {post.tag}
                </span>
                <span className="text-xs text-zinc-400">{post.date}</span>
              </div>
              <h2 className="text-lg font-bold text-zinc-900 group-hover:text-blue-600 transition-colors mb-2 leading-snug">
                {post.title}
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">{post.description}</p>
              <p className="text-sm text-blue-600 mt-4 font-medium">읽기 →</p>
            </a>
          ))}
        </section>

      </main>
      <Footer />
    </>
  );
}

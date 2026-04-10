import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import Features from '@/components/home/Features';
import { zones } from '@/data/zones';

type Props = { params: Promise<{ zone: string }> };

export async function generateStaticParams() {
  return Object.keys(zones).map((zone) => ({ zone }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zone } = await params;
  const zoneName = zones[zone];
  if (!zoneName) return {};

  return {
    title: `${zoneName} 재개발 분담금·수익 시뮬레이션 | Revo`,
    description: `${zoneName} 매물 투자 전, AI로 분담금 폭탄 위험과 5년 뒤 수익을 계산하세요. 공사비 인상·금리 변동 반영 3가지 시나리오.`,
  };
}

export default async function ZonePage({ params }: Props) {
  const { zone } = await params;
  const zoneName = zones[zone];

  if (!zoneName) notFound();

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero zoneName={zoneName} />
        <Features />
      </main>
      <Footer />
    </>
  );
}

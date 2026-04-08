import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '분담금 계산기 — 재개발·재건축 수익률 시뮬레이터',
  description:
    '공사비 인상과 금리 변동을 반영한 3가지 미래 수익 시나리오. 중개소 브리핑이 아닌 알고리즘으로 검증하세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white">{children}</body>
    </html>
  );
}

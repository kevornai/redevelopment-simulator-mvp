import type { Metadata } from 'next';
import Script from 'next/script';
import { GoogleTagManager } from '@next/third-parties/google';
import './globals.css';

// GTM ID는 환경변수 NEXT_PUBLIC_GTM_ID로 관리하세요 (예: GTM-XXXXXXX)
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? 'GTM-XXXXXXX';

export const metadata: Metadata = {
  title: 'Revo — 최고의 AI 기반 재개발·재건축 마진 예측 솔루션',
  description:
    '공사비 인상과 금리 변동을 반영한 3가지 미래 수익 시나리오. 중개소 브리핑이 아닌 알고리즘으로 검증하세요.',
  icons: {
    icon: '/icon.svg',
  },
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
      <body className="min-h-full flex flex-col bg-white">
        <GoogleTagManager gtmId={GTM_ID} />
        {children}
        <Script
          id="clarity-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "w8cupt6fro");
            `,
          }}
        />
      </body>
    </html>
  );
}

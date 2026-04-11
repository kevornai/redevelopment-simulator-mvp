// 내부 테스트 전용 결제 페이지 — 공식 출시 전까지 비공개
// 검색 엔진 색인 차단 및 sitemap 미포함

import { Metadata } from "next";
import CheckoutButton from "@/components/ui/CheckoutButton";

export const metadata: Metadata = {
  title: "결제 테스트 | Revo",
  robots: { index: false, follow: false },
};

export default function PayTestPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-8 p-8">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-md flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-1">
            내부 테스트 전용
          </p>
          <h1 className="text-2xl font-bold text-gray-900">결제 연동 테스트</h1>
          <p className="text-sm text-gray-500 mt-1">
            이 페이지는 공식 출시 전 결제 흐름을 검증하기 위한 내부용 페이지입니다.
          </p>
        </div>

        <hr className="border-gray-100" />

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">상품명</span>
            <span className="font-medium text-gray-800">재건축 분석 리포트 (테스트)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">결제 금액</span>
            <span className="font-bold text-gray-900">99,000원</span>
          </div>
        </div>

        <CheckoutButton
          orderName="재건축 분석 리포트 (테스트)"
          totalAmount={99000}
          userEmail="test@revo.kr"
        />

        <p className="text-xs text-center text-gray-400">
          토스페이먼츠 테스트 모드 · 실제 결제 발생 안 함
        </p>
      </div>
    </main>
  );
}

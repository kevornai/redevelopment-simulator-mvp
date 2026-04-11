"use client";

import { useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generatePaymentId(): string {
  // crypto.randomUUID()는 브라우저 및 Node 18+ 에서 사용 가능
  return crypto.randomUUID();
}

interface CheckoutButtonProps {
  orderName: string;
  /** 원화 기준 결제 금액 (원) */
  totalAmount: number;
  userEmail: string;
}

type PaymentStatus = "idle" | "requesting" | "verifying" | "success" | "failed";

export default function CheckoutButton({
  orderName,
  totalAmount,
  userEmail,
}: CheckoutButtonProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheckout() {
    setStatus("requesting");
    setErrorMessage(null);

    const paymentId = generatePaymentId();

    try {
      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId,
        orderName,
        totalAmount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          email: userEmail,
        },
      });

      // 사용자가 결제창을 닫았거나 오류가 발생한 경우
      if (!response || response.code !== undefined) {
        const message = response?.message ?? "결제가 취소되었습니다.";
        setStatus("failed");
        setErrorMessage(message);
        return;
      }

      // CRITICAL: 프론트엔드에서 결제 성공 처리 금지
      // 반드시 백엔드(Edge Function)에서 금액 검증 후 확정
      setStatus("verifying");

      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { paymentId },
      });

      if (error) {
        setStatus("failed");
        setErrorMessage("결제 검증 중 오류가 발생했습니다. 고객센터로 문의해 주세요.");
        console.error("[verify-payment] Edge Function error:", error);
        return;
      }

      if (data?.status === "PAID") {
        setStatus("success");
      } else {
        setStatus("failed");
        setErrorMessage(data?.message ?? "결제 검증에 실패했습니다.");
      }
    } catch (err) {
      setStatus("failed");
      setErrorMessage("결제 요청 중 예기치 않은 오류가 발생했습니다.");
      console.error("[CheckoutButton] unexpected error:", err);
    }
  }

  const isDisabled = status === "requesting" || status === "verifying";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleCheckout}
        disabled={isDisabled}
        className="rounded-xl bg-blue-600 px-8 py-3 text-white font-semibold text-base
                   hover:bg-blue-700 active:scale-95 transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "requesting" && "결제창 열리는 중..."}
        {status === "verifying" && "결제 확인 중입니다"}
        {(status === "idle" || status === "success" || status === "failed") &&
          `${totalAmount.toLocaleString()}원 결제하기`}
      </button>

      {status === "verifying" && (
        <p className="text-sm text-gray-500 animate-pulse">
          잠시만 기다려 주세요. 결제 내역을 안전하게 확인하고 있습니다.
        </p>
      )}

      {status === "success" && (
        <p className="text-sm text-green-600 font-semibold">
          결제가 완료되었습니다.
        </p>
      )}

      {status === "failed" && errorMessage && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
    </div>
  );
}

// Supabase Edge Function — portone-webhook (Deno)
// 포트원 웹훅 수신 → 페이로드 상태를 맹신하지 않고 API 재조회 후 DB 업데이트

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PORTONE_API_BASE = "https://api.portone.io";

Deno.serve(async (req: Request) => {
  // 포트원은 웹훅을 POST로 전송
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!portoneApiSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("[portone-webhook] 필수 환경 변수 누락");
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── 1. 웹훅 페이로드에서 paymentId 추출 ──────────────────────────────────
  // SECURITY: payload의 status 필드는 절대 신뢰하지 않는다.
  // paymentId만 추출하여 포트원 API를 직접 재조회한다.
  let paymentId: string;
  try {
    const payload = await req.json();
    // 포트원 V2 웹훅 페이로드 스키마: { type, data: { paymentId } }
    paymentId = payload?.data?.paymentId ?? payload?.paymentId;
    if (!paymentId || typeof paymentId !== "string") {
      throw new Error("paymentId 없음");
    }
  } catch (err) {
    console.error("[portone-webhook] 페이로드 파싱 오류:", err);
    return new Response("Bad Request", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── 2. 포트원 API에서 실제 결제 정보 직접 조회 ──────────────────────────
  let portonePayment: PortonePayment;
  try {
    portonePayment = await fetchPortonePayment(paymentId, portoneApiSecret);
  } catch (err) {
    console.error("[portone-webhook] 포트원 API 조회 실패:", err);
    // 포트원에 200을 반환해야 재시도 루프 방지 — 내부 처리 실패는 별도 모니터링
    return new Response("Upstream Error", { status: 502 });
  }

  const actualStatus = portonePayment.status; // e.g. "PAID", "CANCELLED", "FAILED"
  const actualAmount = portonePayment.amount?.total;

  // ── 3. DB에서 주문 조회 ──────────────────────────────────────────────────
  const { data: order, error: dbError } = await supabase
    .from("orders")
    .select("amount, status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (dbError) {
    console.error("[portone-webhook] DB 조회 오류:", dbError);
    return new Response("DB Error", { status: 500 });
  }
  if (!order) {
    // 주문이 없으면 포트원에 200 반환 (웹훅 재전송 방지)
    console.warn(`[portone-webhook] 알 수 없는 paymentId: ${paymentId}`);
    return new Response("OK", { status: 200 });
  }

  // ── 4. 상태별 처리 ──────────────────────────────────────────────────────
  let newStatus: string;

  if (actualStatus === "PAID") {
    const expectedAmount = Number(order.amount);

    if (actualAmount !== expectedAmount) {
      // 금액 위변조: 결제 취소
      console.warn(
        `[portone-webhook] 금액 불일치 — paymentId: ${paymentId}, 기대: ${expectedAmount}, 실제: ${actualAmount}`
      );
      try {
        await cancelPortonePayment(paymentId, portoneApiSecret, "웹훅 금액 불일치 감지");
      } catch (err) {
        console.error("[portone-webhook] 취소 API 오류:", err);
      }
      newStatus = "FAILED";
    } else {
      newStatus = "PAID";
    }
  } else if (actualStatus === "CANCELLED") {
    newStatus = "CANCELLED";
  } else if (actualStatus === "FAILED") {
    newStatus = "FAILED";
  } else {
    // PENDING, VIRTUAL_ACCOUNT_ISSUED 등 중간 상태는 무시
    console.log(`[portone-webhook] 처리 불필요한 상태: ${actualStatus}`);
    return new Response("OK", { status: 200 });
  }

  // ── 5. DB 상태 업데이트 ──────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("payment_id", paymentId);

  if (updateError) {
    console.error("[portone-webhook] 상태 업데이트 오류:", updateError);
    return new Response("DB Update Error", { status: 500 });
  }

  console.log(`[portone-webhook] ${paymentId} → ${newStatus}`);
  // 포트원은 2xx 응답을 받아야 웹훅 재전송을 중단한다
  return new Response("OK", { status: 200 });
});

// ── 헬퍼: 포트원 결제 조회 ────────────────────────────────────────────────
interface PortonePayment {
  paymentId: string;
  status: string;
  amount: { total: number };
}

async function fetchPortonePayment(
  paymentId: string,
  secret: string
): Promise<PortonePayment> {
  const res = await fetch(
    `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `PortOne ${secret}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`포트원 결제 조회 실패 (${res.status}): ${text}`);
  }
  return res.json() as Promise<PortonePayment>;
}

// ── 헬퍼: 포트원 결제 취소 ────────────────────────────────────────────────
async function cancelPortonePayment(
  paymentId: string,
  secret: string,
  reason: string
): Promise<void> {
  const res = await fetch(
    `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `PortOne ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`포트원 결제 취소 실패 (${res.status}): ${text}`);
  }
}

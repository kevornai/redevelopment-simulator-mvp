// Supabase Edge Function — verify-payment (Deno)
// 결제 위변조 검증: 포트원 API로 실제 결제 금액을 재조회하여 DB 금액과 대조한다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PORTONE_API_BASE = "https://api.portone.io";

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!portoneApiSecret || !supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "서버 환경 변수가 설정되지 않았습니다." }, 500);
  }

  // ── 1. 요청 바디에서 paymentId 추출 ──────────────────────────────────────
  let paymentId: string;
  try {
    const body = await req.json();
    paymentId = body?.paymentId;
    if (!paymentId || typeof paymentId !== "string") throw new Error("missing paymentId");
  } catch {
    return jsonResponse({ error: "paymentId가 필요합니다." }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── 2. DB에서 주문의 원래 금액(expected amount) 조회 ────────────────────
  const { data: order, error: dbError } = await supabase
    .from("orders")
    .select("amount, status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (dbError) {
    console.error("[verify-payment] DB 조회 오류:", dbError);
    return jsonResponse({ error: "주문 조회 중 오류가 발생했습니다." }, 500);
  }
  if (!order) {
    return jsonResponse({ error: "해당 주문을 찾을 수 없습니다." }, 404);
  }
  if (order.status === "PAID") {
    // 중복 호출 방어: 이미 검증 완료된 주문
    return jsonResponse({ status: "PAID", message: "이미 처리된 결제입니다." }, 200);
  }

  // ── 3. 포트원 REST API로 실제 결제 금액 조회 ────────────────────────────
  let portonePayment: PortonePayment;
  try {
    portonePayment = await fetchPortonePayment(paymentId, portoneApiSecret);
  } catch (err) {
    console.error("[verify-payment] 포트원 API 오류:", err);
    return jsonResponse({ error: "포트원 결제 조회에 실패했습니다." }, 502);
  }

  const paidAmount = portonePayment.amount?.total;
  const expectedAmount = Number(order.amount);

  // ── 4. 금액 대조 ─────────────────────────────────────────────────────────
  if (paidAmount === expectedAmount) {
    // 정상: DB를 PAID로 업데이트
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "PAID" })
      .eq("payment_id", paymentId);

    if (updateError) {
      console.error("[verify-payment] PAID 업데이트 오류:", updateError);
      return jsonResponse({ error: "결제 확정 중 오류가 발생했습니다." }, 500);
    }
    return jsonResponse({ status: "PAID" }, 200);
  }

  // 위변조 감지: 결제 취소 API 호출 후 FAILED 처리
  console.warn(
    `[verify-payment] 위변조 감지 — paymentId: ${paymentId}, 기대: ${expectedAmount}, 실제: ${paidAmount}`
  );

  try {
    await cancelPortonePayment(paymentId, portoneApiSecret, "결제 금액 위변조 감지");
  } catch (err) {
    // 취소 실패 시에도 DB는 FAILED로 표시하고 오류 로깅
    console.error("[verify-payment] 결제 취소 오류:", err);
  }

  await supabase
    .from("orders")
    .update({ status: "FAILED" })
    .eq("payment_id", paymentId);

  return jsonResponse(
    { status: "FAILED", message: "결제 금액이 일치하지 않아 취소 처리되었습니다." },
    400
  );
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
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: `PortOne ${secret}`,
      "Content-Type": "application/json",
    },
  });

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

// ── 헬퍼: JSON 응답 생성 ─────────────────────────────────────────────────
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

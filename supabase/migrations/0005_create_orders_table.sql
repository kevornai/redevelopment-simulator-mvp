-- Migration: 0005_create_orders_table
-- 결제 주문 내역을 저장하는 테이블

CREATE TABLE IF NOT EXISTS public.orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL,
  payment_id  TEXT        UNIQUE NOT NULL,
  amount      NUMERIC     NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 서비스 롤만 쓰기/읽기 허용 (Edge Function은 service_role key 사용)
CREATE POLICY "service_role_all" ON public.orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

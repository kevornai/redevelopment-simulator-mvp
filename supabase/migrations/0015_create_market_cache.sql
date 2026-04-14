-- 공공 API 데이터 캐시 테이블
-- KOSIS(건설공사비지수), ECOS(금리) 등 주기적으로 업데이트
CREATE TABLE IF NOT EXISTS public.market_cache (
  key         TEXT PRIMARY KEY,   -- 'construction_cost', 'rates' 등
  value       JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source      TEXT                -- 'kosis', 'ecos', 'manual'
);

ALTER TABLE public.market_cache DISABLE ROW LEVEL SECURITY;

-- 초기 기본값 삽입 (KOSIS 장기 평균)
INSERT INTO public.market_cache (key, value, source) VALUES
  ('construction_cost', '{
    "rRecent": 0.007,
    "rLong": 0.002,
    "currentIndex": 131.5,
    "basePeriod": "202503",
    "fromApi": false
  }', 'manual')
ON CONFLICT (key) DO NOTHING;

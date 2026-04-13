-- Migration: 0008_add_lawd_cd_to_zones
-- 법정동코드 (시군구 5자리) 추가 — MOLIT 실거래가 API 조회용

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS lawd_cd TEXT;
  -- 예: '11650' = 서초구, '11140' = 용산구, '11680' = 강남구

-- 한남3구역: 용산구 11140
UPDATE public.zones_data
SET lawd_cd = '11140'
WHERE zone_id = 'hannam3';

-- 반포주공1단지: 서초구 11650
UPDATE public.zones_data
SET lawd_cd = '11650'
WHERE zone_id = 'banpo';

-- 인덱스 (구역 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_zones_data_lawd_cd ON public.zones_data(lawd_cd);

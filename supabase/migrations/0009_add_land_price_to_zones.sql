-- Migration: 0009_add_land_price_to_zones
-- 개별공시지가 추가 — 재건축 대지지분 기반 감정평가 계산용
-- ※ 관리자 별도 입력사항: 국토부 부동산 공시가격 알리미에서 조회 후 입력

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS land_official_price_per_sqm NUMERIC;
  -- 개별공시지가 (원/㎡) — 해당 단지 소재 필지 기준

-- 반포주공1단지: 서초구 반포동 공시지가 (2024년 기준 약 1,600만원/㎡)
UPDATE public.zones_data
SET land_official_price_per_sqm = 16000000
WHERE zone_id = 'banpo';

-- 한남3구역: 용산구 한남동 공시지가 (2024년 기준 약 1,200만원/㎡)
UPDATE public.zones_data
SET land_official_price_per_sqm = 12000000
WHERE zone_id = 'hannam3';

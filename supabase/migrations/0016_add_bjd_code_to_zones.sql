-- Migration: 0016_add_bjd_code_to_zones
-- 법정동코드 10자리 (bjd_code) 추가
-- 카카오 주소검색 API의 b_code 값 저장 → NSDI 공시가격 정밀 조회에 사용

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS bjd_code TEXT;  -- 법정동코드 10자리 (예: "4111310700")

COMMENT ON COLUMN public.zones_data.bjd_code IS
  '법정동코드 10자리 — 카카오 지오코딩 시 b_code 필드에서 추출. NSDI 공시가격 조회에 사용';

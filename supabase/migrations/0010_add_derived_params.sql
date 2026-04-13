-- Migration: 0010_add_derived_params
-- 착공예정월 + 조합원분양가 출처 컬럼 추가
-- 시스템이 자동 추정하고, 공표된 경우에만 admin이 덮어씀

-- 착공예정월 (YYYYMM) — 조합 또는 시공사가 공표한 경우에만 입력
-- NULL이면 project_stage 기반 통계 추정값 사용
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS construction_start_announced_ym TEXT;
  -- 형식: 'YYYYMM', 예: '202606'

-- 조합원 분양가 출처
-- 'cost_estimated' : 총사업비 역산 자동 추정
-- 'announced'      : 관리처분계획서 공표 값 (admin 입력, 가장 신뢰)
-- 'manual'         : 기타 수동 입력
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS member_sale_price_source TEXT
    NOT NULL DEFAULT 'cost_estimated'
    CHECK (member_sale_price_source IN ('cost_estimated', 'announced', 'manual'));

-- 반포주공1단지: 착공예정 2026년 6월 (임시값, 관리처분 이후 공표 시 업데이트)
UPDATE public.zones_data
SET
  construction_start_announced_ym = '202606',
  member_sale_price_source = 'manual'  -- 기존에 수동 입력한 값
WHERE zone_id = 'banpo';

-- 한남3구역: 착공예정 미발표 (통계 추정 사용)
UPDATE public.zones_data
SET
  construction_start_announced_ym = NULL,
  member_sale_price_source = 'cost_estimated'
WHERE zone_id = 'hannam3';

-- Migration: 0007_enhance_zones_data
-- 재건축 아파트 지원 및 고도화 지표 컬럼 추가

-- 1. 사업 유형 구분 컬럼
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'redevelopment'
    CHECK (project_type IN ('redevelopment', 'reconstruction'));
  -- 'redevelopment' = 재개발, 'reconstruction' = 재건축

-- 2. 사업 단계 정보
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS project_stage TEXT NOT NULL DEFAULT 'management_disposal'
    CHECK (project_stage IN (
      'zone_designation',         -- 구역지정
      'basic_plan',               -- 기본계획
      'project_implementation',   -- 사업시행인가
      'management_disposal',      -- 관리처분인가
      'relocation',               -- 이주/철거
      'construction_start',       -- 착공
      'completion'                -- 준공/입주
    ));

-- 3. 단계별 잔여 사업기간 (착공 기준)
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS months_to_construction_start INT NOT NULL DEFAULT 0;
  -- 현재 단계에서 착공까지 남은 개월 수 (이주/철거 기간 포함)

-- 4. 보유비용 관련
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS holding_loan_ratio NUMERIC NOT NULL DEFAULT 0.6;
  -- 매수자 LTV 가정 (매수가 대비 대출 비율, 통상 60%)

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS annual_holding_rate NUMERIC NOT NULL DEFAULT 0.042;
  -- 연간 주택담보대출 금리 (보유 기간 이자 비용 계산)

-- 5. 재건축 전용 필드
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS reconstruction_safety_passed BOOLEAN NOT NULL DEFAULT TRUE;
  -- 안전진단 통과 여부

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS existing_apt_pyung NUMERIC;
  -- 기존 아파트 전용면적 (평) — 재건축 물건의 현재 크기

-- 6. 세금/비용 상수
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS acquisition_tax_rate NUMERIC NOT NULL DEFAULT 0.028;
  -- 취득세율 (조합원 입주권 취득: 2.8% 기본, 상황따라 다름)

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS move_out_cost NUMERIC NOT NULL DEFAULT 5000000;
  -- 이사비/명도비 추정 (원)

-- 7. 수익성 기준 지표
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS target_yield_rate NUMERIC NOT NULL DEFAULT 0.08;
  -- 목표 수익률 (연) — 기회비용 계산 기준 (예: 8% = 예금금리 대비 프리미엄)

-- 8. 분담금 납부 스케줄 비율
ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS contribution_at_construction NUMERIC NOT NULL DEFAULT 0.5;
  -- 착공 시 납부 비율 (통상 50%)
  -- 나머지 (1 - 이 값)는 입주 시 납부

-- 한남3구역 추가 필드 업데이트
UPDATE public.zones_data
SET
  project_type                = 'redevelopment',
  project_stage               = 'management_disposal',
  months_to_construction_start = 18,
  holding_loan_ratio          = 0.6,
  annual_holding_rate         = 0.042,
  reconstruction_safety_passed = TRUE,
  existing_apt_pyung          = NULL,
  acquisition_tax_rate        = 0.028,
  move_out_cost               = 8000000,
  target_yield_rate           = 0.08,
  contribution_at_construction = 0.5
WHERE zone_id = 'hannam3';

-- 재건축 테스트 시드: 반포주공1단지
INSERT INTO public.zones_data (
  zone_id,
  project_type,
  project_stage,
  avg_appraisal_rate,
  base_project_months,
  t_admin_remaining,
  delay_conflict,
  months_to_construction_start,
  current_construction_cost,
  r_recent,
  r_long,
  decay_factor,
  alpha,
  p_base,
  peak_local,
  mdd_local,
  member_sale_price_per_pyung,
  neighbor_new_apt_price,
  pf_loan_ratio,
  annual_pf_rate,
  total_floor_area,
  total_appraisal_value,
  general_sale_area,
  member_sale_area,
  holding_loan_ratio,
  annual_holding_rate,
  reconstruction_safety_passed,
  existing_apt_pyung,
  acquisition_tax_rate,
  move_out_cost,
  target_yield_rate,
  contribution_at_construction
) VALUES (
  'banpo',
  'reconstruction',         -- 재건축
  'management_disposal',    -- 관리처분 단계
  1.05,                     -- 재건축 아파트: 감정평가율 105% (시세 근접)
  60,                       -- 입주까지 60개월
  6,                        -- 남은 행정 절차 6개월
  18,                       -- 분쟁 지연 18개월
  12,                       -- 착공까지 12개월 더 필요
  10500000,                 -- 평당 공사비: 1,050만원 (고급 마감)
  0.007,
  0.002,
  0.04,
  0.002,
  120000000,                -- 현재 평당 일반분양가: 1.2억
  160000000,                -- 인근 최고가: 1.6억/평
  0.15,                     -- 최대 낙폭 15%
  90000000,                 -- 평당 조합원 분양가: 9,000만원
  4500000000,               -- 인근 신축 59㎡ 시세: 45억
  0.5,
  0.065,
  280000,                   -- 총 연면적: 28만㎡
  8000000000000,            -- 총종전평가액: 8조
  90000,                    -- 일반분양면적: 9만㎡
  190000,                   -- 조합원분양면적: 19만㎡
  0.5,
  0.042,
  TRUE,
  16,                       -- 기존 아파트 전용면적: 16평 (구 46㎡형)
  0.028,
  3000000,                  -- 이사비: 300만원
  0.08,
  0.5
);

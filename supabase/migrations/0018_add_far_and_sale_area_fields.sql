-- 재건축 후 면적 계산에 필요한 필드 추가
-- member_sale_area / general_sale_area 추정을 위한 입력값

ALTER TABLE zones_data
  ADD COLUMN IF NOT EXISTS public_contribution_ratio  NUMERIC(5,4)  DEFAULT NULL,  -- 기부체납률 (예: 0.10 = 10%)
  ADD COLUMN IF NOT EXISTS incentive_far_bonus         NUMERIC(6,4)  DEFAULT NULL,  -- 인센티브 추가 용적률 (예: 1.0 = 100%)
  ADD COLUMN IF NOT EXISTS member_avg_pyung            NUMERIC(6,2)  DEFAULT NULL,  -- 조합원 평균 분양 평형 (㎡)
  ADD COLUMN IF NOT EXISTS efficiency_ratio            NUMERIC(4,3)  DEFAULT NULL;  -- 전용면적 효율 (예: 0.80)

-- Migration: 0013_add_gyeonggi_fields
-- 경기도 정비사업 엑셀 포맷 기반 상세 필드 추가
-- "다다익선" — 저장해두고 필요한 것만 사용

ALTER TABLE public.zones_data
  -- 위치 기본 정보
  ADD COLUMN IF NOT EXISTS sigungu TEXT,                        -- 시군구
  ADD COLUMN IF NOT EXISTS zone_area_sqm NUMERIC,               -- 구역면적 (㎡)
  ADD COLUMN IF NOT EXISTS existing_building_year INT,          -- 기존주택 준공년도

  -- 기존주택 세대 현황
  ADD COLUMN IF NOT EXISTS existing_units_total INT,            -- 기존 세대수 합계
  ADD COLUMN IF NOT EXISTS existing_units_u40 INT,              -- ~40㎡
  ADD COLUMN IF NOT EXISTS existing_units_40_60 INT,            -- 40~60㎡
  ADD COLUMN IF NOT EXISTS existing_units_60_85 INT,            -- 60~85㎡
  ADD COLUMN IF NOT EXISTS existing_units_85_135 INT,           -- 85~135㎡
  ADD COLUMN IF NOT EXISTS existing_units_o135 INT,             -- 135㎡~

  -- 사업시행 세대수
  ADD COLUMN IF NOT EXISTS planned_units_total INT,             -- 사업시행 세대수 합계
  ADD COLUMN IF NOT EXISTS planned_units_member INT,            -- 조합원 분양
  ADD COLUMN IF NOT EXISTS planned_units_general INT,           -- 일반 분양
  ADD COLUMN IF NOT EXISTS planned_units_rent INT,              -- 임대

  -- 신축주택 세대수 (분양)
  ADD COLUMN IF NOT EXISTS new_units_sale_total INT,            -- 분양 합계
  ADD COLUMN IF NOT EXISTS new_units_sale_u40 INT,
  ADD COLUMN IF NOT EXISTS new_units_sale_40_60 INT,
  ADD COLUMN IF NOT EXISTS new_units_sale_60_85 INT,
  ADD COLUMN IF NOT EXISTS new_units_sale_85_135 INT,
  ADD COLUMN IF NOT EXISTS new_units_sale_o135 INT,

  -- 신축주택 세대수 (임대)
  ADD COLUMN IF NOT EXISTS new_units_rent_total INT,
  ADD COLUMN IF NOT EXISTS new_units_rent_u40 INT,
  ADD COLUMN IF NOT EXISTS new_units_rent_40_60 INT,
  ADD COLUMN IF NOT EXISTS new_units_rent_60_85 INT,

  -- 용적률
  ADD COLUMN IF NOT EXISTS floor_area_ratio_existing NUMERIC,   -- 기존 용적률 (%)
  ADD COLUMN IF NOT EXISTS floor_area_ratio_new NUMERIC,        -- 신축 용적률 (%)

  -- 소유자/조합원
  ADD COLUMN IF NOT EXISTS land_owners_count INT,               -- 토지등소유자수
  ADD COLUMN IF NOT EXISTS association_members_count INT,       -- 조합원수

  -- 사업 예정 기간
  ADD COLUMN IF NOT EXISTS project_period_start TEXT,           -- 사업예정기간 시작 (YYYY)
  ADD COLUMN IF NOT EXISTS project_period_end TEXT,             -- 사업예정기간 완료 (YYYY)

  -- 주요 인허가 날짜 (YYYYMM or YYYY-MM-DD)
  ADD COLUMN IF NOT EXISTS basic_plan_date TEXT,                -- 기본계획 수립일
  ADD COLUMN IF NOT EXISTS zone_designation_date TEXT,          -- 정비구역지정일 (최초)
  ADD COLUMN IF NOT EXISTS zone_designation_change_date TEXT,   -- 정비구역지정 변경일
  ADD COLUMN IF NOT EXISTS promotion_committee_date TEXT,       -- 추진위 승인일
  ADD COLUMN IF NOT EXISTS safety_inspection_grade TEXT,        -- 안전진단 등급 (A~E)
  ADD COLUMN IF NOT EXISTS association_approval_date TEXT,      -- 조합설립인가일
  ADD COLUMN IF NOT EXISTS project_implementation_date TEXT,    -- 사업시행인가일
  ADD COLUMN IF NOT EXISTS management_disposal_date TEXT,       -- 관리처분인가일
  ADD COLUMN IF NOT EXISTS construction_start_date TEXT,        -- 착공일 (실제)
  ADD COLUMN IF NOT EXISTS general_sale_date TEXT,              -- 일반분양일
  ADD COLUMN IF NOT EXISTS completion_date TEXT,                -- 준공일
  ADD COLUMN IF NOT EXISTS transfer_notice_date TEXT,           -- 이전고시일

  -- 기타
  ADD COLUMN IF NOT EXISTS project_operator TEXT;               -- 사업시행자

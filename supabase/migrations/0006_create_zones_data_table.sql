-- Migration: 0006_create_zones_data_table
-- 구역별 System DB 상수 테이블 (계산 엔진 입력값)

CREATE TABLE IF NOT EXISTS public.zones_data (
  zone_id                     TEXT        PRIMARY KEY, -- zones.ts key와 1:1 매핑
  avg_appraisal_rate          NUMERIC     NOT NULL DEFAULT 1.3,   -- 예상 감정평가율
  base_project_months         INT         NOT NULL DEFAULT 60,    -- 입주까지 표준 개월 수
  t_admin_remaining           INT         NOT NULL DEFAULT 12,    -- 남은 행정 절차 개월
  delay_conflict              INT         NOT NULL DEFAULT 24,    -- 분쟁 시 지연 개월
  current_construction_cost   NUMERIC     NOT NULL,               -- 현재 평당 공사비 (원)
  r_recent                    NUMERIC     NOT NULL DEFAULT 0.008, -- 최근 3년 월평균 공사비 인상률
  r_long                      NUMERIC     NOT NULL DEFAULT 0.002, -- 과거 10년 월평균 공사비 인상률
  decay_factor                NUMERIC     NOT NULL DEFAULT 0.04,  -- 감쇠 상수 λ
  alpha                       NUMERIC     NOT NULL DEFAULT 0.002, -- 지정학적 위기 프리미엄
  p_base                      NUMERIC     NOT NULL,               -- 현재 평당 일반분양가 (원)
  peak_local                  NUMERIC     NOT NULL,               -- 인근 신축 역대 최고 실거래가 (원)
  mdd_local                   NUMERIC     NOT NULL DEFAULT 0.22,  -- 역사적 최대 낙폭 (소수)
  member_sale_price_per_pyung NUMERIC     NOT NULL,               -- 평당 조합원 분양가 (원)
  neighbor_new_apt_price      NUMERIC     NOT NULL,               -- 인근 신축 아파트 시세 (원, 타겟 평형 기준)
  pf_loan_ratio               NUMERIC     NOT NULL DEFAULT 0.5,   -- PF 대출 비율
  annual_pf_rate              NUMERIC     NOT NULL DEFAULT 0.065, -- 연간 PF 금리
  total_floor_area            NUMERIC     NOT NULL,               -- 구역 총 연면적 (㎡)
  total_appraisal_value       NUMERIC     NOT NULL,               -- 구역 총종전평가액 (원)
  general_sale_area           NUMERIC     NOT NULL,               -- 일반분양면적 (㎡)
  member_sale_area            NUMERIC     NOT NULL,               -- 조합원분양면적 (㎡)
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.zones_data ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (계산 엔진에서 조회)
CREATE POLICY "public_read_zones_data" ON public.zones_data
  FOR SELECT TO anon, authenticated
  USING (true);

-- 관리자(service_role)만 쓰기 가능
CREATE POLICY "service_role_write_zones_data" ON public.zones_data
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 테스트용 시드 데이터: 한남3구역
-- 출처: 공개된 정비사업 정보 기반 추정값 (실제 서비스 시 정확한 데이터로 교체 필요)
INSERT INTO public.zones_data (
  zone_id,
  avg_appraisal_rate,
  base_project_months,
  t_admin_remaining,
  delay_conflict,
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
  member_sale_area
) VALUES (
  'hannam3',
  1.35,           -- 감정평가율: 빌라 기준 135%
  72,             -- 입주까지 72개월 (관리처분 이후 기준)
  10,             -- 남은 행정 절차 10개월
  24,             -- 분쟁 시 24개월 지연
  9500000,        -- 현재 평당 공사비: 950만원
  0.007,          -- 최근 3년 월평균 인상률: 0.7%
  0.002,          -- 과거 10년 월평균 인상률: 0.2%
  0.04,           -- 감쇠 상수 λ: 0.04
  0.002,          -- 지정학적 위기 프리미엄: 0.2%
  85000000,       -- 현재 평당 일반분양가: 8,500만원 (59㎡ 기준)
  120000000,      -- 인근 최고 실거래가: 1.2억/평 (한남더힐 등)
  0.18,           -- 역사적 최대 낙폭: 18%
  55000000,       -- 평당 조합원 분양가: 5,500만원
  2800000000,     -- 인근 신축 59㎡ 시세: 28억
  0.5,            -- PF 대출 비율: 50%
  0.065,          -- 연간 PF 금리: 6.5%
  350000,         -- 총 연면적: 35만㎡
  4500000000000,  -- 총종전평가액: 4.5조
  140000,         -- 일반분양면적: 14만㎡
  210000          -- 조합원분양면적: 21만㎡
);

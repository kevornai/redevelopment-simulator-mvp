-- 정비사업 단계별 실측 타임라인 (사업기간 통계 원시 데이터)
CREATE TABLE IF NOT EXISTS stage_timeline_raw (
  id              bigserial PRIMARY KEY,
  zone_name       text        NOT NULL,
  sido            text,
  sigungu         text,
  project_type    text,   -- 'reconstruction' | 'redevelopment' | null
  date_zone_designation   date,
  date_promotion_committee date,
  date_association        date,
  date_implementation     date,
  date_management_disposal date,
  date_construction_start  date,
  date_general_sale        date,
  date_completion          date,
  source          text        NOT NULL, -- 'cleansys_national' | 'cleansys_seoul'
  source_id       text,                 -- 원본 proId / id
  scraped_at      timestamptz DEFAULT now(),
  UNIQUE (source, source_id)
);

-- RLS 불필요 (서버 전용 테이블 — service role로만 접근)
ALTER TABLE stage_timeline_raw DISABLE ROW LEVEL SECURITY;

-- 조합원/일반분양가 할인율 원시 데이터 (관리처분계획서 PDF 파싱 결과)
CREATE TABLE IF NOT EXISTS discount_rate_raw (
  id                       bigserial PRIMARY KEY,
  zone_name                text        NOT NULL,
  sido                     text,
  sigungu                  text,
  region_type              text,   -- 'gangnam' | 'seoul_other' | 'gyeonggi_incheon' | 'local'
  pyung_type               text,   -- '59A', '84B', '전용84' 등
  member_sale_price        bigint,  -- 조합원분양가 (원)
  general_sale_price       bigint,  -- 일반분양예정가 (원)
  discount_rate            numeric(5,4), -- member/general (예: 0.7300)
  management_disposal_year int,
  pdf_url                  text,
  source                   text NOT NULL,
  source_id                text,
  scraped_at               timestamptz DEFAULT now()
);

ALTER TABLE discount_rate_raw DISABLE ROW LEVEL SECURITY;

-- upsert 지원용 유니크 제약
ALTER TABLE discount_rate_raw ADD CONSTRAINT discount_rate_raw_source_source_id_key UNIQUE (source, source_id);

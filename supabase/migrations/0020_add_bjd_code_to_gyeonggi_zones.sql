-- gyeonggi_zones에 bjd_code(법정동코드 10자리) 컬럼 추가
-- 지오코딩 시 Kakao 역지오코딩으로 자동 채움
ALTER TABLE gyeonggi_zones ADD COLUMN IF NOT EXISTS bjd_code TEXT;

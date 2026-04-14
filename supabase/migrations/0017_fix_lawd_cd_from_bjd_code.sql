-- Migration 0017: bjd_code(법정동코드 10자리) 앞 5자리로 lawd_cd 자동 교정
--
-- 배경:
--   Excel 임포트 시 lawd_cd를 수동으로 입력했는데 시 단위(예: 41110 수원시 전체)로
--   잘못 입력된 경우가 있음. MOLIT API는 시군구 단위(예: 41113 수원시 권선구)가 필요.
--   Kakao 지오코딩으로 얻은 bjd_code(10자리)는 시군구 단위까지 포함하므로
--   앞 5자리를 lawd_cd로 사용하면 더 정확함.
--
-- 대상: bjd_code가 있는 모든 레코드 (lawd_cd가 다른 경우만 업데이트)

UPDATE public.zones_data
SET lawd_cd = LEFT(bjd_code, 5)
WHERE bjd_code IS NOT NULL
  AND bjd_code != ''
  AND LENGTH(bjd_code) >= 5
  AND (lawd_cd IS NULL OR lawd_cd != LEFT(bjd_code, 5));

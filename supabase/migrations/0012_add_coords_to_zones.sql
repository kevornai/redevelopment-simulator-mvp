-- Migration: 0012_add_coords_to_zones
-- lat/lng 컬럼 추가 — 지도 표시용 (카카오 REST API 지오코딩으로 채움)
-- zone_name 컬럼 추가 — 지도 레이블용

ALTER TABLE public.zones_data
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS zone_name TEXT;

-- 기존 하드코딩 구역 좌표 업데이트
UPDATE public.zones_data SET lat = 37.5065, lng = 126.9987, zone_name = '반포주공1단지' WHERE zone_id = 'banpo';
UPDATE public.zones_data SET lat = 37.4803, lng = 127.0677, zone_name = '개포주공1단지' WHERE zone_id = 'gaepo';
UPDATE public.zones_data SET lat = 37.4785, lng = 127.0630, zone_name = '개포4단지'     WHERE zone_id = 'gaepo4';
UPDATE public.zones_data SET lat = 37.4930, lng = 127.1218, zone_name = '둔촌주공'      WHERE zone_id = 'dunchon';
UPDATE public.zones_data SET lat = 37.5093, lng = 127.0917, zone_name = '잠실주공5단지' WHERE zone_id = 'chamsil';
UPDATE public.zones_data SET lat = 37.4840, lng = 127.0070, zone_name = '서초구역'      WHERE zone_id = 'seocho';
UPDATE public.zones_data SET lat = 37.6550, lng = 127.0562, zone_name = '노원 재건축'   WHERE zone_id = 'nowon';
UPDATE public.zones_data SET lat = 37.5265, lng = 126.8746, zone_name = '목동 아파트'   WHERE zone_id = 'mokdong';
UPDATE public.zones_data SET lat = 37.4249, lng = 126.9954, zone_name = '과천주공7단지' WHERE zone_id = 'gwacheon';
UPDATE public.zones_data SET lat = 37.4278, lng = 126.9875, zone_name = '과천1구역'     WHERE zone_id = 'gwacheon1';
UPDATE public.zones_data SET lat = 37.4261, lng = 126.9895, zone_name = '과천2구역'     WHERE zone_id = 'gwacheon2';
UPDATE public.zones_data SET lat = 37.3796, lng = 127.1219, zone_name = '분당 수내동'   WHERE zone_id = 'bundang_sunae';
UPDATE public.zones_data SET lat = 37.3836, lng = 127.1188, zone_name = '분당 서현동'   WHERE zone_id = 'bundang_seohyeon';
UPDATE public.zones_data SET lat = 37.3894, lng = 126.9529, zone_name = '평촌 신도시'   WHERE zone_id = 'pyeongchon';
UPDATE public.zones_data SET lat = 37.6580, lng = 126.7701, zone_name = '일산 신도시'   WHERE zone_id = 'ilsan';

-- 재개발 구역 좌표 (한남3 포함 — 기존 hannam3 데이터)
UPDATE public.zones_data SET lat = 37.5373, lng = 126.9993, zone_name = '한남3구역' WHERE zone_id = 'hannam3';

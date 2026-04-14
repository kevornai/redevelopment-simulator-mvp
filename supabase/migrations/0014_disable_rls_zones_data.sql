-- zones_data는 공개 지도 데이터 — RLS 불필요
-- 관리자 쓰기 보호는 서버 API(비공개 URL)에서 담당
ALTER TABLE public.zones_data DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*) FROM waitlist;
$$;

GRANT EXECUTE ON FUNCTION get_waitlist_count() TO anon;

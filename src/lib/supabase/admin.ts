import { createClient } from '@supabase/supabase-js';

/**
 * Service role 클라이언트 — RLS 우회, 서버 전용
 * 절대 클라이언트 컴포넌트에서 사용하지 말 것
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

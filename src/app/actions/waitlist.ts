'use server';

import { createClient } from '@/lib/supabase/server';

export async function joinWaitlist(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailRegex.test(email)) {
    return { error: '유효한 이메일 주소를 입력해 주세요.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('waitlist').insert([{ email }]);

  if (error) {
    if (error.code === '23505') return { error: '이미 등록된 이메일입니다.' };
    return { error: '서버 오류가 발생했습니다. 다시 시도해 주세요.' };
  }

  return { success: true };
}

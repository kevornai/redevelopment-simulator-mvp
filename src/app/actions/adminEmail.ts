'use server';

import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import MarketingEmail from '@/emails/MarketingEmail';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Revo 데이터 분석팀 <revo@revo-invest.com>';

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface SendMarketingEmailOptions {
  subject: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}

export async function sendMarketingEmail(options: SendMarketingEmailOptions) {
  const supabase = await createClient();

  const { data: users, error } = await supabase
    .from('waitlist')
    .select('email')
    .eq('marketing_consent', true);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!users || users.length === 0) return { sent: 0 };

  const emails = users.map((u) => u.email as string);
  const batches = chunk(emails, 100);

  const results = await Promise.all(
    batches.map((batch) =>
      resend.batch.send(
        batch.map((email) => ({
          from: FROM,
          to: email,
          subject: options.subject,
          react: MarketingEmail({
            subject: options.subject,
            bodyHtml: options.bodyHtml,
            ctaText: options.ctaText,
            ctaUrl: options.ctaUrl,
          }),
        }))
      )
    )
  );

  const totalSent = results.reduce((sum, r) => sum + (r.data?.data?.length ?? 0), 0);
  return { sent: totalSent };
}

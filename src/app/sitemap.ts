import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://revo-invest.com';

// sitemap도 빌드 타임 실행 — cookies() 없는 공개 클라이언트 사용
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from('zones_data')
    .select('zone_id, updated_at');

  const zoneEntries = (data ?? []).map((z: { zone_id: string; updated_at: string }) => ({
    url: `${BASE_URL}/${z.zone_id}`,
    lastModified: new Date(z.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    ...zoneEntries,
  ];
}

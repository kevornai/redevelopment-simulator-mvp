import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE_URL = 'https://revo-invest.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('zones_data')
    .select('zone_id, updated_at');

  const zoneEntries = (data ?? []).map((z) => ({
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

import type { MetadataRoute } from 'next';
import { zones } from '@/data/zones';

const BASE_URL = 'https://revo-invest.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const zoneEntries = Object.keys(zones).map((zone) => ({
    url: `${BASE_URL}/${zone}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...zoneEntries,
  ];
}

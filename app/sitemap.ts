import type { MetadataRoute } from 'next'
import { getPublishedSlugs } from '@/lib/db/qa'
import { CATEGORIES } from '@/lib/categories'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://aitorah.ai'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/study', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/search', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/answers', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/topics', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/community', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
  ]

  const entries: MetadataRoute.Sitemap = staticPages.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))

  for (const cat of CATEGORIES) {
    entries.push({
      url: `${BASE_URL}/topics/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  const slugs = await getPublishedSlugs()
  for (const slug of slugs) {
    entries.push({
      url: `${BASE_URL}/answers/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return entries
}

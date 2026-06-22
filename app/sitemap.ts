import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://aitorah.ai'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: '/', priority: 1.0 },
    { path: '/study', priority: 0.9 },
    { path: '/search', priority: 0.9 },
    { path: '/community', priority: 0.7 },
    { path: '/contact', priority: 0.6 },
  ]

  return pages.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority,
  }))
}

import { NextRequest } from 'next/server'
import { getQaBySlug, getRecentQaPairs } from '@/lib/db/qa'

export async function GET(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (slug) {
    const qa = await getQaBySlug(slug)
    if (!qa) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(qa)
  }

  const recent = await getRecentQaPairs(50)
  return Response.json({ items: recent })
}

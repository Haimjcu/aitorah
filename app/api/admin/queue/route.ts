import { eq, desc, sql, and } from 'drizzle-orm'
import { isAdmin, computeAiScore } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { qaPairs } from '@/lib/db/schema'

export async function GET(req: Request) {
  const { authorized } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const offset = (page - 1) * limit

  const db = getDb()

  const [items, countResult, categoryStats] = await Promise.all([
    db.select()
      .from(qaPairs)
      .where(eq(qaPairs.status, status))
      .orderBy(desc(qaPairs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(qaPairs)
      .where(eq(qaPairs.status, status)),
    db.select({
      category: sql<string>`unnest(categories)`,
      count: sql<number>`count(*)::int`,
    })
      .from(qaPairs)
      .where(eq(qaPairs.status, 'approved'))
      .groupBy(sql`unnest(categories)`),
  ])

  const categoryCounts: Record<string, number> = {}
  for (const row of categoryStats) {
    categoryCounts[row.category] = row.count
  }

  const scored = items.map((item) => {
    if (item.aiScore != null) {
      return item
    }

    const { score, reasons } = computeAiScore(
      item.answerMarkdown,
      item.sourceRefs,
      item.question,
      item.categories,
      0,
      categoryCounts,
    )
    return { ...item, aiScore: score, aiScoreReasons: reasons }
  })

  scored.sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))

  return Response.json({
    items: scored,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  })
}

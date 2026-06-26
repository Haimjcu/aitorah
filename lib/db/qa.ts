import { eq, ne, desc, and, sql, inArray } from 'drizzle-orm'
import { getDb } from './index'
import { qaPairs } from './schema'
import { cacheGet, cacheSet } from '../redis'
import type { RetrievedSource } from '../sefaria/types'

function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

function generateSlug(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export async function saveQaPair(
  question: string,
  answerMarkdown: string,
  sources: RetrievedSource[]
): Promise<void> {
  try {
    const db = getDb()
    const sourceRefs = sources.map((s) => s.ref)
    const topics = Array.from(new Set(sources.flatMap((s) => s.topic_slug ? [s.topic_slug] : [])))
    const categories = Array.from(new Set(sources.flatMap((s) => s.categories)))

    await db.insert(qaPairs).values({
      question,
      questionNormalized: normalizeQuestion(question),
      answerMarkdown,
      sourceRefs,
      topics: topics.length > 0 ? topics : null,
      categories: categories.length > 0 ? categories : null,
      slug: generateSlug(question),
    }).onConflictDoNothing()
  } catch (error) {
    console.error('Failed to save Q&A pair:', error)
  }
}

export async function findSimilarQuestion(
  question: string
): Promise<{ answerMarkdown: string; sourceRefs: string[]; slug: string | null } | null> {
  try {
    const db = getDb()
    const normalized = normalizeQuestion(question)

    const result = await db
      .select()
      .from(qaPairs)
      .where(eq(qaPairs.questionNormalized, normalized))
      .limit(1)

    if (result.length > 0) {
      await db
        .update(qaPairs)
        .set({ viewCount: sql`${qaPairs.viewCount} + 1` })
        .where(eq(qaPairs.id, result[0].id))

      return {
        answerMarkdown: result[0].answerMarkdown,
        sourceRefs: result[0].sourceRefs,
        slug: result[0].slug,
      }
    }

    return null
  } catch {
    return null
  }
}

export async function getQaBySlug(slug: string) {
  try {
    const db = getDb()
    const result = await db
      .select()
      .from(qaPairs)
      .where(eq(qaPairs.slug, slug))
      .limit(1)

    if (result.length > 0) {
      await db
        .update(qaPairs)
        .set({ viewCount: sql`${qaPairs.viewCount} + 1` })
        .where(eq(qaPairs.id, result[0].id))
    }

    return result[0] ?? null
  } catch {
    return null
  }
}

export async function getRecentQaPairs(limit = 20) {
  try {
    const db = getDb()
    return await db
      .select({
        slug: qaPairs.slug,
        question: qaPairs.question,
        categories: qaPairs.categories,
        createdAt: qaPairs.createdAt,
        viewCount: qaPairs.viewCount,
      })
      .from(qaPairs)
      .orderBy(desc(qaPairs.createdAt))
      .limit(limit)
  } catch {
    return []
  }
}

export async function getPublishedQaBySlug(slug: string) {
  const cacheKey = `qa:${slug}`
  const cached = await cacheGet<Awaited<ReturnType<typeof _fetchPublishedBySlug>>>(cacheKey)
  if (cached) return cached

  const result = await _fetchPublishedBySlug(slug)
  if (result) await cacheSet(cacheKey, result, 3600)
  return result
}

async function _fetchPublishedBySlug(slug: string) {
  try {
    const db = getDb()
    const [item] = await db.select()
      .from(qaPairs)
      .where(and(eq(qaPairs.slug, slug), eq(qaPairs.status, 'approved')))
      .limit(1)

    if (!item) return null

    if (item.canonicalId) {
      const [canonical] = await db.select({ slug: qaPairs.slug })
        .from(qaPairs)
        .where(eq(qaPairs.id, item.canonicalId))
        .limit(1)
      if (canonical?.slug) return { redirect: canonical.slug }
    }

    db.update(qaPairs)
      .set({ viewCount: sql`${qaPairs.viewCount} + 1` })
      .where(eq(qaPairs.id, item.id))
      .then(() => {})
      .catch(() => {})

    return item
  } catch {
    return null
  }
}

export async function getRelatedQaPairs(currentId: string, categories: string[] | null, limit = 5) {
  try {
    const db = getDb()
    const results = await db.select({
      slug: qaPairs.slug,
      question: qaPairs.question,
      categories: qaPairs.categories,
      metaDescription: qaPairs.metaDescription,
    })
      .from(qaPairs)
      .where(
        and(
          eq(qaPairs.status, 'approved'),
          ne(qaPairs.id, currentId),
        )
      )
      .orderBy(desc(qaPairs.viewCount))
      .limit(limit)

    return results
  } catch {
    return []
  }
}

export async function getPublishedQaPairs(opts: {
  category?: string
  page?: number
  limit?: number
} = {}) {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 20
  const offset = (page - 1) * limit

  try {
    const db = getDb()

    const conditions = [eq(qaPairs.status, 'approved')]
    if (opts.category) {
      conditions.push(sql`${opts.category} = ANY(categories)`)
    }

    const [items, countResult] = await Promise.all([
      db.select({
        slug: qaPairs.slug,
        question: qaPairs.question,
        categories: qaPairs.categories,
        metaDescription: qaPairs.metaDescription,
        featuredImageUrl: qaPairs.featuredImageUrl,
        publishedAt: qaPairs.publishedAt,
        viewCount: qaPairs.viewCount,
      })
        .from(qaPairs)
        .where(and(...conditions))
        .orderBy(desc(qaPairs.publishedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(qaPairs)
        .where(and(...conditions)),
    ])

    return {
      items,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    }
  } catch {
    return { items: [], total: 0, page, limit }
  }
}

export async function getPublishedSlugs(): Promise<string[]> {
  const cacheKey = 'qa:all-slugs'
  const cached = await cacheGet<string[]>(cacheKey)
  if (cached) return cached

  try {
    const db = getDb()
    const results = await db.select({ slug: qaPairs.slug })
      .from(qaPairs)
      .where(eq(qaPairs.status, 'approved'))
      .orderBy(desc(qaPairs.publishedAt))

    const slugs = results.map(r => r.slug).filter((s): s is string => !!s)
    await cacheSet(cacheKey, slugs, 21600)
    return slugs
  } catch {
    return []
  }
}

export async function getCategoryStats(): Promise<{ category: string; count: number }[]> {
  const cacheKey = 'qa:category-stats'
  const cached = await cacheGet<{ category: string; count: number }[]>(cacheKey)
  if (cached) return cached

  try {
    const db = getDb()
    const results = await db.select({
      category: sql<string>`unnest(categories)`,
      count: sql<number>`count(*)::int`,
    })
      .from(qaPairs)
      .where(eq(qaPairs.status, 'approved'))
      .groupBy(sql`unnest(categories)`)
      .orderBy(desc(sql`count(*)::int`))

    await cacheSet(cacheKey, results, 1800)
    return results
  } catch {
    return []
  }
}

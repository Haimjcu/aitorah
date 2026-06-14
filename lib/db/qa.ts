import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from './index'
import { qaPairs } from './schema'
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

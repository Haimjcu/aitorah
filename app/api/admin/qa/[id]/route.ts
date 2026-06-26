import { eq, ne, and, sql } from 'drizzle-orm'
import { isAdmin } from '@/lib/admin'
import { getDb } from '@/lib/db'
import { qaPairs } from '@/lib/db/schema'
import { generateFeaturedImage } from '@/lib/image-gen'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const [item] = await db.select().from(qaPairs).where(eq(qaPairs.id, id)).limit(1)
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  const similar = await db.select({
    id: qaPairs.id,
    question: qaPairs.question,
    slug: qaPairs.slug,
    status: qaPairs.status,
    categories: qaPairs.categories,
  })
    .from(qaPairs)
    .where(
      and(
        ne(qaPairs.id, id),
        eq(qaPairs.questionNormalized, item.questionNormalized),
      )
    )
    .limit(5)

  return Response.json({ item, similar })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { action, question, answerMarkdown, metaTitle, metaDescription } = body

  const db = getDb()

  const [existing] = await db.select().from(qaPairs).where(eq(qaPairs.id, id)).limit(1)
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  if (action === 'approve') {
    const finalQuestion = question ?? existing.question
    const finalAnswer = answerMarkdown ?? existing.answerMarkdown
    const autoTitle = metaTitle ?? `${finalQuestion} — AI Torah`
    const autoDesc = metaDescription ?? finalAnswer.slice(0, 155).replace(/\n/g, ' ').trim() + '...'
    const slug = existing.slug ?? id

    let featuredImageUrl = existing.featuredImageUrl
    if (!featuredImageUrl) {
      featuredImageUrl = await generateFeaturedImage(finalQuestion, existing.categories, slug)
    }

    await db.update(qaPairs)
      .set({
        status: 'approved',
        publishedAt: new Date(),
        question: finalQuestion,
        answerMarkdown: finalAnswer,
        metaTitle: autoTitle,
        metaDescription: autoDesc,
        ...(featuredImageUrl ? { featuredImageUrl } : {}),
      })
      .where(eq(qaPairs.id, id))

    return Response.json({ status: 'approved', id, featuredImageUrl })
  }

  if (action === 'save') {
    const updates: Record<string, string> = {}
    if (question) updates.question = question
    if (answerMarkdown) updates.answerMarkdown = answerMarkdown

    if (Object.keys(updates).length > 0) {
      await db.update(qaPairs)
        .set(updates)
        .where(eq(qaPairs.id, id))
    }

    const [updated] = await db.select().from(qaPairs).where(eq(qaPairs.id, id)).limit(1)
    return Response.json({ status: 'saved', item: updated })
  }

  if (action === 'generate-image') {
    const slug = existing.slug ?? id
    const featuredImageUrl = await generateFeaturedImage(
      existing.question, existing.categories, slug
    )
    if (!featuredImageUrl) {
      return Response.json({ error: 'Image generation failed' }, { status: 500 })
    }

    await db.update(qaPairs)
      .set({ featuredImageUrl })
      .where(eq(qaPairs.id, id))

    return Response.json({ status: 'image-generated', featuredImageUrl })
  }

  if (action === 'reject') {
    await db.update(qaPairs)
      .set({ status: 'rejected' })
      .where(eq(qaPairs.id, id))

    return Response.json({ status: 'rejected', id })
  }

  if (action === 'merge') {
    const { canonicalId } = body
    if (!canonicalId) return Response.json({ error: 'canonicalId required' }, { status: 400 })

    await db.update(qaPairs)
      .set({ status: 'rejected', canonicalId })
      .where(eq(qaPairs.id, id))

    return Response.json({ status: 'merged', id, canonicalId })
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 })
}

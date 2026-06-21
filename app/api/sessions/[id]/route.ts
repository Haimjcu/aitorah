import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { studySessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

async function getAuthUserId() {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params
  const db = getDb()
  const [session] = await db.select().from(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .limit(1)

  if (!session) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    ...session,
    messages: JSON.parse(session.messages),
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params
  const body = await req.json()
  const db = getDb()

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.title !== undefined) updates.title = body.title
  if (body.messages !== undefined) updates.messages = JSON.stringify(body.messages)

  const [updated] = await db.update(studySessions)
    .set(updates)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .returning({ id: studySessions.id, title: studySessions.title, updatedAt: studySessions.updatedAt })

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params
  const db = getDb()
  await db.delete(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))

  return new Response(null, { status: 204 })
}

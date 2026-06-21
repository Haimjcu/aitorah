import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { studySessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return Response.json([])
  }

  const db = getDb()
  const sessions = await db.select({
    id: studySessions.id,
    title: studySessions.title,
    updatedAt: studySessions.updatedAt,
  })
    .from(studySessions)
    .where(eq(studySessions.userId, session.user.id))
    .orderBy(desc(studySessions.updatedAt))
    .limit(50)

  return Response.json(sessions)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { title, messages } = await req.json()

  const db = getDb()
  const [created] = await db.insert(studySessions).values({
    userId: session.user.id,
    title: title || 'New Session',
    messages: JSON.stringify(messages || []),
  }).returning({
    id: studySessions.id,
    title: studySessions.title,
    updatedAt: studySessions.updatedAt,
  })

  return Response.json(created, { status: 201 })
}

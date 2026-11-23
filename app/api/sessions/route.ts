import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { studySessions } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { getProject, touchProject } from '@/lib/user-data'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return Response.json([])
  }

  const projectId = new URL(req.url).searchParams.get('projectId')
  const db = getDb()
  const sessions = await db.select({
    id: studySessions.id,
    title: studySessions.title,
    updatedAt: studySessions.updatedAt,
    projectId: studySessions.projectId,
  })
    .from(studySessions)
    .where(projectId
      ? and(eq(studySessions.userId, session.user.id), eq(studySessions.projectId, projectId))
      : eq(studySessions.userId, session.user.id))
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

  const { title, messages, projectId } = await req.json()
  // Only attach to a project the user owns.
  const project = typeof projectId === 'string' ? await getProject(session.user.id, projectId) : null

  const db = getDb()
  const [created] = await db.insert(studySessions).values({
    userId: session.user.id,
    title: title || 'New Session',
    messages: JSON.stringify(messages || []),
    projectId: project?.id ?? null,
  }).returning({
    id: studySessions.id,
    title: studySessions.title,
    updatedAt: studySessions.updatedAt,
  })

  if (project) touchProject(project.id).catch(() => {})
  return Response.json(created, { status: 201 })
}

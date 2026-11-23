import { requireUser } from '@/lib/api-auth'
import { createProject, getProfile, LimitError, listProjects } from '@/lib/user-data'

export async function GET() {
  const u = await requireUser(); if ('error' in u) return u.error
  return Response.json(await listProjects(u.userId))
}

export async function POST(req: Request) {
  const u = await requireUser(); if ('error' in u) return u.error
  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return Response.json({ error: 'Title required' }, { status: 400 })
  try {
    const profile = await getProfile(u.userId)
    const project = await createProject(u.userId, profile?.plan, title, typeof body.description === 'string' ? body.description : null)
    return Response.json(project, { status: 201 })
  } catch (e) {
    if (e instanceof LimitError) return Response.json({ error: 'Project limit reached', limit: e.limit }, { status: 403 })
    throw e
  }
}

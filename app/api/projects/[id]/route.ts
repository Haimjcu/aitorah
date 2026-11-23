import { requireUser } from '@/lib/api-auth'
import { archiveProject, getProjectDetail, updateProject } from '@/lib/user-data'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  const detail = await getProjectDetail(u.userId, (await params).id)
  return detail ? Response.json(detail) : Response.json({ error: 'Not found' }, { status: 404 })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  const body = await req.json().catch(() => ({}))
  const row = await updateProject(u.userId, (await params).id, { title: body.title, description: body.description })
  return row ? Response.json(row) : Response.json({ error: 'Not found' }, { status: 404 })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  await archiveProject(u.userId, (await params).id)
  return new Response(null, { status: 204 })
}

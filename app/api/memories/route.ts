// POST {content, projectId?}: add a memory. DELETE ?id=: remove one (soft delete).
import { requireUser } from '@/lib/api-auth'
import { addMemory, deleteMemory, getProfile, LimitError } from '@/lib/user-data'

export async function POST(req: Request) {
  const u = await requireUser(); if ('error' in u) return u.error
  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return Response.json({ error: 'Content required' }, { status: 400 })
  const projectId = typeof body.projectId === 'string' ? body.projectId : null
  try {
    const profile = await getProfile(u.userId)
    const row = await addMemory(u.userId, profile?.plan, content, projectId, projectId ? 'pinned' : 'user')
    return Response.json(row, { status: 201 })
  } catch (e) {
    if (e instanceof LimitError) return Response.json({ error: 'Memory limit reached', limit: e.limit }, { status: 403 })
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const u = await requireUser(); if ('error' in u) return u.error
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await deleteMemory(u.userId, id)
  return new Response(null, { status: 204 })
}

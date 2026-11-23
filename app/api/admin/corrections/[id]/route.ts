// PATCH {action: 'accept'|'reject', note?} on a correction.
import { isAdmin } from '@/lib/admin'
import { auth } from '@/lib/auth'
import { decideCorrection } from '@/lib/corrections'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b.action !== 'accept' && b.action !== 'reject') return Response.json({ error: 'Unknown action' }, { status: 400 })
  const session = await auth()
  const row = await decideCorrection((await params).id, b.action, session?.user?.id ?? null, typeof b.note === 'string' ? b.note : null)
  return row ? Response.json(row) : Response.json({ error: 'Not found' }, { status: 404 })
}

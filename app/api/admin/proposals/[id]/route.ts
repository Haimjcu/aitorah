// PATCH {action: 'approve'|'reject'}: owner decision on a learning-loop proposal.
import { isAdmin } from '@/lib/admin'
import { decideProposal } from '@/lib/learning-loop'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, email } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b.action !== 'approve' && b.action !== 'reject') return Response.json({ error: 'Unknown action' }, { status: 400 })
  try {
    const r = await decideProposal((await params).id, b.action, email ?? 'owner')
    return r ? Response.json(r) : Response.json({ error: 'Not found' }, { status: 404 })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}

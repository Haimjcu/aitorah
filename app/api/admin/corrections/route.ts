import { isAdmin } from '@/lib/admin'
import { listCorrections } from '@/lib/corrections'
import { listProposals } from '@/lib/learning-loop'

export async function GET(req: Request) {
  const { authorized } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const view = new URL(req.url).searchParams.get('view') ?? 'review'
  const statuses: Record<string, string[]> = {
    review: ['triaged', 'reviewer_approved'],
    accepted: ['accepted', 'proposed', 'applied'],
    rejected: ['rejected'],
  }
  if (view === 'proposals') return Response.json(await listProposals())
  return Response.json(await listCorrections(statuses[view] ?? statuses.review))
}

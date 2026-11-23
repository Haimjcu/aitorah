import { isAdmin } from '@/lib/admin'
import { listSkills } from '@/lib/agent/skill-admin'

export async function GET() {
  const { authorized } = await isAdmin()
  if (!authorized) return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Database not configured' }, { status: 503 })
  return Response.json(await listSkills())
}

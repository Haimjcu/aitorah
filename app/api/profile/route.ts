import { requireUser } from '@/lib/api-auth'
import { getProfile, listMemories, updateProfile } from '@/lib/user-data'

export async function GET() {
  const u = await requireUser(); if ('error' in u) return u.error
  const [profile, memories] = await Promise.all([getProfile(u.userId), listMemories(u.userId, null)])
  return Response.json({ profile, memories })
}

export async function PUT(req: Request) {
  const u = await requireUser(); if ('error' in u) return u.error
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  for (const k of ['uiLanguage', 'answerLanguage', 'nusach', 'level']) if (k in body) patch[k] = body[k]
  return Response.json(await updateProfile(u.userId, patch))
}

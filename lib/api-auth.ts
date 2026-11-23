import { auth } from '@/lib/auth'

/** For user-data routes: returns the signed-in user id, or an error Response. */
export async function requireUser(): Promise<{ userId: string } | { error: Response }> {
  if (!process.env.DATABASE_URL) return { error: Response.json({ error: 'Database not configured' }, { status: 503 }) }
  const session = await auth().catch(() => null)
  const userId = session?.user?.id
  if (!userId) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { userId }
}

// POST {question, answer, text, category?, qaPairId?, domain?, skillVersions?}: a user suggests a correction.
// Open to signed-out users too (treated as untrusted); rate-limited.
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/ratelimit'
import { submitCorrection } from '@/lib/corrections'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) return Response.json({ error: 'Database not configured' }, { status: 503 })
  const limited = await checkRateLimit(req)
  if (limited) return limited
  const b = await req.json().catch(() => null)
  const text = typeof b?.text === 'string' ? b.text.trim() : ''
  const question = typeof b?.question === 'string' ? b.question : ''
  const answer = typeof b?.answer === 'string' ? b.answer : ''
  if (text.length < 5 || !answer) return Response.json({ error: 'Please describe the correction' }, { status: 400 })
  const session = await auth().catch(() => null)
  const row = await submitCorrection(client, {
    userId: session?.user?.id ?? null,
    question, answer, text,
    category: typeof b.category === 'string' ? b.category : null,
    qaPairId: typeof b.qaPairId === 'string' ? b.qaPairId : null,
    domain: typeof b.domain === 'string' ? b.domain : null,
    skillVersions: b.skillVersions && typeof b.skillVersions === 'object' ? b.skillVersions : null,
  })
  return Response.json({ id: row.id, status: row.status === 'rejected' ? 'received' : 'received' }, { status: 201 })
}

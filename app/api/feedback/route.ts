import { NextRequest } from 'next/server'
import { z } from 'zod'

const FeedbackSchema = z.object({
  sessionId: z.string().uuid(),
  messageIdx: z.number().int().min(0),
  rating: z.number().int().min(1).max(5),
  correction: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    // TODO: write to rlhf_feedback table once DATABASE_URL is set
    console.log('RLHF feedback received:', parsed.data)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

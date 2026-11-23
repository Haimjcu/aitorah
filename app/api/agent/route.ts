// New agent chat endpoint (Server-Sent Events). The legacy /api/chat stays as the fallback (AGENT_ENABLED=false).
//
// Event stream (each line `data: <json>\n\n`):
//   {type:'route', domains, language}   {type:'status', tool, label}   {type:'text', delta}
//   {type:'sources', sources}           {type:'citations', cited, unverified}
//   {type:'done', stopReason}           {type:'error', message}
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { userProfiles, memories as memoriesTable } from '@/lib/db/schema'
import { checkRateLimit } from '@/lib/ratelimit'
import { resolveGeo } from '@/lib/hebcal/geo'
import { runAgent, type AgentEvent } from '@/lib/agent/run'
import { logAnswer } from '@/lib/db/answer-logs'
import { saveQaPair } from '@/lib/db/qa'
import { agentEnabled } from '@/lib/flags'
import type { RetrievedSource } from '@/lib/sefaria/types'
import { and, isNull } from 'drizzle-orm'

export const maxDuration = 300

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const hasDb = !!process.env.DATABASE_URL

type Msg = { role: 'user' | 'assistant'; content: string }

async function loadUserContext(userId: string | undefined) {
  if (!hasDb || !userId) return { profile: null, memories: [] as string[] }
  try {
    const db = getDb()
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1)
    const mems = await db.select({ content: memoriesTable.content }).from(memoriesTable)
      .where(and(eq(memoriesTable.userId, userId), isNull(memoriesTable.projectId), isNull(memoriesTable.deletedAt)))
      .limit(30)
    return { profile: profile ?? null, memories: mems.map((m) => m.content) }
  } catch (e) {
    console.error('agent: user context load failed:', e)
    return { profile: null, memories: [] as string[] }
  }
}

export async function POST(req: NextRequest) {
  if (!agentEnabled()) return Response.json({ error: 'Agent disabled' }, { status: 404 })
  const rateLimited = await checkRateLimit(req)
  if (rateLimited) return rateLimited

  const body = await req.json().catch(() => null)
  const messages: Msg[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: Msg) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map((m: Msg) => ({ role: m.role, content: m.content }))
    : []
  // Conversation must start with a user turn (the UI's greeting is an assistant message).
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'Messages must end with a user message' }, { status: 400 })
  }

  const session = await auth().catch(() => null)
  const [{ profile, memories }, geo] = await Promise.all([
    loadUserContext(session?.user?.id),
    resolveGeo(req).catch(() => null),
  ])
  const turn = messages.filter((m) => m.role === 'user').length

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent | { type: 'error'; message: string }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      try {
        const r = await runAgent(client, {
          messages,
          geo,
          profile: profile ? { nusach: profile.nusach, level: profile.level, answerLanguage: profile.answerLanguage } : null,
          memories,
          onEvent: send,
        })
        logAnswer({
          pipeline: 'agent',
          intent: r.route.domains.join('+'),
          language: r.route.language,
          calls: r.calls,
          latencyMs: r.latencyMs,
          ttftMs: r.ttftMs,
          stopReason: r.stopReason,
          toolCalls: { calls: r.toolCalls, unverified_citations: r.citations.unverified, skills: r.skillVersions },
          turn,
        })
        // Only standalone first questions become public Q&A pages (follow-ups lack context).
        if (hasDb && turn === 1 && r.stopReason === 'end_turn' && r.answer.length > 50 && !r.route.off_topic) {
          const sources = r.sources.map((s) => ({ ref: s.ref, heRef: s.heRef ?? '', categories: s.category ? [s.category] : [] })) as RetrievedSource[]
          saveQaPair(messages[0].content, r.answer, sources, r.route.language).catch(() => {})
        }
      } catch (e) {
        console.error('agent error:', e)
        send({ type: 'error', message: 'Something went wrong. Please try again.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

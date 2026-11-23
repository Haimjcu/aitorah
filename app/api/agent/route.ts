// New agent chat endpoint (Server-Sent Events). The legacy /api/chat stays as the fallback (AGENT_ENABLED=false).
//
// Event stream (each line `data: <json>\n\n`):
//   {type:'route', domains, language}   {type:'status', tool, label}   {type:'text', delta}
//   {type:'sources', sources}           {type:'citations', cited, unverified}
//   {type:'done', stopReason}           {type:'error', message}
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { getProfile, getProject, listMemories } from '@/lib/user-data'
import { listProjectFiles } from '@/lib/files'
import { checkRateLimit } from '@/lib/ratelimit'
import { resolveGeo } from '@/lib/hebcal/geo'
import { runAgent, type AgentEvent } from '@/lib/agent/run'
import { logAnswer } from '@/lib/db/answer-logs'
import { saveQaPair } from '@/lib/db/qa'
import { agentEnabled } from '@/lib/flags'
import type { RetrievedSource } from '@/lib/sefaria/types'

export const maxDuration = 300

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const hasDb = !!process.env.DATABASE_URL

type Msg = { role: 'user' | 'assistant'; content: string }

async function loadUserContext(userId: string | undefined, projectId: string | null) {
  const empty = { profile: null, memories: [] as string[], project: null, projectMemories: [] as string[], projectFiles: [] as { id: string; filename: string; mime: string; description: string | null }[] }
  if (!hasDb || !userId) return empty
  try {
    const [profile, mems, project] = await Promise.all([
      getProfile(userId),
      listMemories(userId, null),
      projectId ? getProject(userId, projectId) : Promise.resolve(null),
    ])
    const [projectMems, files] = project
      ? await Promise.all([listMemories(userId, project.id), listProjectFiles(project.id)])
      : [[], []]
    return {
      profile,
      memories: mems.slice(0, 30).map((m) => m.content),
      project,
      projectMemories: projectMems.slice(0, 50).map((m) => m.content),
      projectFiles: files.filter((f) => f.status === 'ready').slice(0, 40).map(({ id, filename, mime, description }) => ({ id, filename, mime, description })),
    }
  } catch (e) {
    console.error('agent: user context load failed:', e)
    return empty
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
  const userId = session?.user?.id
  const projectId = typeof body?.projectId === 'string' ? body.projectId : null
  const [{ profile, memories, project, projectMemories, projectFiles }, geo] = await Promise.all([
    loadUserContext(userId, projectId),
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
          projectMemories,
          projectFiles,
          projectTitle: project?.title ?? null,
          projectId: project?.id ?? null,
          userId: hasDb ? userId : null,
          plan: profile?.plan ?? null,
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
        // Project chats are private study; never publish them.
        if (hasDb && turn === 1 && !project && r.stopReason === 'end_turn' && r.answer.length > 50 && !r.route.off_topic) {
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

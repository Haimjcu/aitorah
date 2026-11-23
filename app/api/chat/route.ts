import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { retrieve, formatSourcesForPrompt, sourcesToClientFormat } from '@/lib/rag/retrieval'
import { buildStudyPartnerSystemPrompt } from '@/lib/ai/prompts'
import { ANSWER_MODEL, INTENT_MODEL, routeParams } from '@/lib/ai/models'
import { logAnswer, type ModelCall } from '@/lib/db/answer-logs'
import { saveQaPair, findSimilarQuestion } from '@/lib/db/qa'
import { checkRateLimit } from '@/lib/ratelimit'
import { classifyIntent } from '@/lib/rag/intent'
import { resolveCalendar } from '@/lib/hebcal/resolver'
import { resolveGeo } from '@/lib/hebcal/geo'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const hasDb = !!process.env.DATABASE_URL

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const rateLimited = await checkRateLimit(req)
    if (rateLimited) return rateLimited

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages required' }, { status: 400 })
    }

    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    if (!lastUserMessage) {
      return Response.json({ error: 'No user message found' }, { status: 400 })
    }
    const turn = messages.filter((m: { role: string }) => m.role === 'user').length

    if (hasDb && messages.length <= 1) {
      const cached = await findSimilarQuestion(lastUserMessage.content)
      if (cached) {
        logAnswer({ pipeline: 'legacy', calls: [], cacheHit: true, latencyMs: Date.now() - startedAt, turn })
        const encoder = new TextEncoder()
        const sourcesJson = JSON.stringify(
          cached.sourceRefs.map((ref) => ({ ref, type: '', similarity: 0, hebrew: '', english: '' }))
        )
        const body = `<!--SOURCES:${sourcesJson}-->${cached.answerMarkdown}`
        return new Response(encoder.encode(body), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Cache': 'HIT' },
        })
      }
    }

    const intent = await classifyIntent(lastUserMessage.content, client)

    let calendarContext: string | undefined
    let parashaRef: string | undefined

    if (intent.type.startsWith('calendar_')) {
      try {
        const geo = intent.calendar_params?.needs_location
          ? await resolveGeo(req)
          : null
        const calResult = await resolveCalendar(intent, geo)
        calendarContext = calResult.text
        parashaRef = calResult.parashaRef
      } catch (e) {
        console.error('Hebcal resolution failed, continuing without calendar data:', e)
      }
    }

    if (parashaRef && intent.refs.length === 0) {
      intent.refs.push(parashaRef)
    }

    const { sources } = await retrieve(lastUserMessage.content, client, intent)

    const passagesText = formatSourcesForPrompt(sources)
    const systemPrompt = buildStudyPartnerSystemPrompt(passagesText, calendarContext)

    const clientSources = sourcesToClientFormat(sources)

    const stream = await client.messages.stream({
      ...routeParams(ANSWER_MODEL),
      system: systemPrompt,
      messages: messages
        .filter((m: { role: string; content: string }) => m.role === 'user' || m.role === 'assistant')
        .map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    })

    let fullAnswer = ''
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`<!--SOURCES:${JSON.stringify(clientSources)}-->`))

        let ttftMs: number | null = null
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            if (ttftMs === null) ttftMs = Date.now() - startedAt
            fullAnswer += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // Don't cache refused or truncated answers.
        const final = await stream.finalMessage()
        const { stop_reason } = final
        let complete = stop_reason === 'end_turn'
        if (stop_reason === 'refusal') {
          console.warn('Chat answer refused by model')
          controller.enqueue(encoder.encode(
            fullAnswer
              ? '\n\n*The answer was interrupted. Please try rephrasing your question.*'
              : 'I wasn\'t able to answer this question. Please try rephrasing it.'
          ))
        } else if (stop_reason === 'max_tokens') {
          console.warn('Chat answer hit max_tokens')
          complete = false
        }
        controller.close()

        const calls: ModelCall[] = [{ model: final.model, usage: final.usage }]
        if (intent.usage) calls.unshift({ model: INTENT_MODEL.model, usage: intent.usage })
        logAnswer({
          pipeline: 'legacy',
          intent: intent.type,
          language: intent.language,
          calls,
          latencyMs: Date.now() - startedAt,
          ttftMs,
          stopReason: stop_reason,
          turn,
        })

        if (hasDb && complete && fullAnswer.length > 50) {
          saveQaPair(lastUserMessage.content, fullAnswer, sources, intent.language).catch(() => {})
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

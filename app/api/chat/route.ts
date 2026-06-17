import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { retrieve, formatSourcesForPrompt, sourcesToClientFormat } from '@/lib/rag/retrieval'
import { buildStudyPartnerSystemPrompt } from '@/lib/ai/prompts'
import { saveQaPair, findSimilarQuestion } from '@/lib/db/qa'
import { checkRateLimit } from '@/lib/ratelimit'
import { classifyIntent } from '@/lib/rag/intent'
import { resolveCalendar } from '@/lib/hebcal/resolver'
import { resolveGeo } from '@/lib/hebcal/geo'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const hasDb = !!process.env.DATABASE_URL

export async function POST(req: NextRequest) {
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

    if (hasDb && messages.length <= 1) {
      const cached = await findSimilarQuestion(lastUserMessage.content)
      if (cached) {
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
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
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

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullAnswer += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()

        if (hasDb && fullAnswer.length > 50) {
          saveQaPair(lastUserMessage.content, fullAnswer, sources).catch(() => {})
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

// Eval target: the legacy single-prompt pipeline, non-streaming.
// Mirrors app/api/chat/route.ts (classify → calendar → retrieve → one Sonnet call) without touching it.
import Anthropic from '@anthropic-ai/sdk'
import { classifyIntent } from '@/lib/rag/intent'
import { retrieve, formatSourcesForPrompt } from '@/lib/rag/retrieval'
import { buildStudyPartnerSystemPrompt } from '@/lib/ai/prompts'
import { resolveCalendar } from '@/lib/hebcal/resolver'
import { ANSWER_MODEL, INTENT_MODEL, routeParams } from '@/lib/ai/models'
import type { ModelCall } from '@/lib/db/answer-logs'
import type { EvalCase, Target } from '../types'

export function legacyTarget(client: Anthropic): Target {
  return async (c: EvalCase) => {
    const started = Date.now()
    const intent = await classifyIntent(c.question, client)
    let calendarContext: string | undefined
    if (intent.type.startsWith('calendar_')) {
      try {
        const cal = await resolveCalendar(intent, null) // no user IP in evals: resolver defaults
        calendarContext = cal.text
        if (cal.parashaRef && intent.refs.length === 0) intent.refs.push(cal.parashaRef)
      } catch { /* same as production: continue without calendar data */ }
    }
    const { sources } = await retrieve(c.question, client, intent)
    const system = buildStudyPartnerSystemPrompt(formatSourcesForPrompt(sources), calendarContext)
    const messages: Anthropic.MessageParam[] = [
      ...(c.context ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: c.question },
    ]
    const res = await client.messages.stream({ ...routeParams(ANSWER_MODEL), system, messages }).finalMessage()
    const answer = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
    const calls: ModelCall[] = [{ model: res.model, usage: res.usage }]
    if (intent.usage) calls.unshift({ model: INTENT_MODEL.model, usage: intent.usage })
    return {
      answer,
      sourceRefs: sources.map((s) => s.ref),
      stopReason: res.stop_reason,
      calls,
      latencyMs: Date.now() - started,
      meta: { intent: intent.type, language: intent.language },
    }
  }
}

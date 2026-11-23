import { getDb } from './index'
import { answerLogs } from './schema'
import { estimateCost, type UsageLike } from '@/lib/ai/models'

const hasDb = !!process.env.DATABASE_URL

export interface ModelCall {
  model: string
  usage: UsageLike
}

export interface AnswerLogInput {
  pipeline: 'legacy' | 'agent' | 'eval'
  intent?: string | null
  language?: string | null
  calls: ModelCall[]
  latencyMs?: number
  ttftMs?: number | null
  stopReason?: string | null
  toolCalls?: unknown
  cacheHit?: boolean
  turn?: number
}

/** Sum token usage and estimated cost across all model calls that produced one answer. */
export function summarizeCalls(calls: ModelCall[]) {
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0, costUsd = 0
  for (const c of calls) {
    inputTokens += c.usage.input_tokens ?? 0
    outputTokens += c.usage.output_tokens ?? 0
    cacheReadTokens += c.usage.cache_read_input_tokens ?? 0
    cacheWriteTokens += c.usage.cache_creation_input_tokens ?? 0
    costUsd += estimateCost(c.model, c.usage) ?? 0
  }
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd }
}

/** Fire-and-forget: logging must never break or slow an answer. */
export function logAnswer(input: AnswerLogInput): void {
  if (!hasDb) return
  const totals = summarizeCalls(input.calls)
  getDb()
    .insert(answerLogs)
    .values({
      pipeline: input.pipeline,
      intent: input.intent ?? null,
      language: input.language ?? null,
      models: [...new Set(input.calls.map((c) => c.model))],
      ...totals,
      latencyMs: input.latencyMs ?? null,
      ttftMs: input.ttftMs ?? null,
      stopReason: input.stopReason ?? null,
      toolCalls: input.toolCalls ?? null,
      cacheHit: input.cacheHit ?? false,
      turn: input.turn ?? null,
    })
    .catch((e) => console.error('answer log failed:', e))
}

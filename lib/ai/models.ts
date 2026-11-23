// Single source of truth for Claude model settings. Never hard-code a model string elsewhere.
//
// Claude 5.x models always think adaptively, and thinking tokens count against max_tokens,
// so limits here are much higher than the old Sonnet 4.6 / Haiku 4.5 values (2048 / 512).
// Depth and cost are controlled with `effort` instead.

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

interface ModelRoute {
  model: string
  maxTokens: number
  effort: Effort
}

/** Main study-partner answers (chat, admin regenerate, seed script). */
export const ANSWER_MODEL: ModelRoute = {
  model: 'claude-sonnet-5-5',
  maxTokens: 16000,
  effort: 'medium',
}

/** Intent classification: short JSON output, latency-sensitive. */
export const INTENT_MODEL: ModelRoute = {
  model: 'claude-haiku-5-5',
  maxTokens: 2048,
  effort: 'low',
}

/** Eval judge and learning-loop proposer. */
export const JUDGE_MODEL: ModelRoute = {
  model: 'claude-opus-5-5',
  maxTokens: 16000,
  effort: 'high',
}

// $ per 1M tokens (Anthropic list prices, 2026-11). Cache write = 1.25× input (5-min TTL), cache read = 0.1× input
// except where Anthropic lists otherwise. Used only for logging/monitoring estimates.
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.10, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.20, cacheWrite: 5 },
}

export interface UsageLike {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

/** Estimated USD cost of one response. Returns null for unknown models. */
export function estimateCost(model: string, usage: UsageLike, batch = false): number | null {
  const p = PRICING[model]
  if (!p) return null
  const usd =
    ((usage.input_tokens ?? 0) * p.input +
      (usage.output_tokens ?? 0) * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6
  return batch ? usd / 2 : usd
}

/** Spread into messages.create / messages.stream params. */
export function routeParams(route: ModelRoute) {
  return {
    model: route.model,
    max_tokens: route.maxTokens,
    output_config: { effort: route.effort },
  }
}

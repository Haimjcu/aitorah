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
  // AGENT_MODEL lets evals compare answer models (e.g. claude-opus-5-5 for halacha) without a code change.
  model: ['claude-sonnet-5-5', 'claude-opus-5-5'].includes(process.env.AGENT_MODEL ?? '') ? process.env.AGENT_MODEL! : 'claude-sonnet-5-5',
  maxTokens: 16000,
  // AGENT_EFFORT lets evals compare effort levels without a code change.
  effort: (['low', 'medium', 'high', 'xhigh', 'max'].includes(process.env.AGENT_EFFORT ?? '') ? process.env.AGENT_EFFORT : 'medium') as Effort,
}

/**
 * Halacha & minhag answers: Opus 5.5. In evals (2026-11-23) it was the only setup with zero serious halachic
 * errors under both an Opus and a Sonnet judge, at ~5x Sonnet's cost per answer. AGENT_HALACHA_MODEL overrides.
 */
export const HALACHA_ANSWER_MODEL: ModelRoute = {
  model: ['claude-sonnet-5-5', 'claude-opus-5-5'].includes(process.env.AGENT_HALACHA_MODEL ?? '') ? process.env.AGENT_HALACHA_MODEL! : 'claude-opus-5-5',
  maxTokens: 16000,
  effort: 'medium',
}

/** Answer model for a routed question: halacha/minhag as primary domain → HALACHA_ANSWER_MODEL. */
export function answerModelFor(primaryDomain: string | undefined): ModelRoute {
  return primaryDomain === 'halacha_minhag' && !process.env.AGENT_MODEL ? HALACHA_ANSWER_MODEL : ANSWER_MODEL
}

/** Eval judges: grading with two different models and averaging reduces self-preference bias. */
export const JUDGE_PANEL = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const

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

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

/** Spread into messages.create / messages.stream params. */
export function routeParams(route: ModelRoute) {
  return {
    model: route.model,
    max_tokens: route.maxTokens,
    output_config: { effort: route.effort },
  }
}

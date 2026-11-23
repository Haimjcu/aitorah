// Eval target: the new agent pipeline (lib/agent/run.ts).
// AGENT_EVAL_NO_SKILLS=1 runs the base prompt only (M2 harness-vs-legacy comparison).
import type Anthropic from '@anthropic-ai/sdk'
import { runAgent } from '@/lib/agent/run'
import type { LoadedSkill } from '@/lib/agent/skills'
import type { Target } from '../types'

export function agentTarget(client: Anthropic, skillOverrides?: Record<string, LoadedSkill>): Target {
  return async (c) => {
    const r = await runAgent(client, {
      messages: [...(c.context ?? []), { role: 'user', content: c.question }],
      geo: null,
      noSkills: process.env.AGENT_EVAL_NO_SKILLS === '1',
      skillOverrides,
    })
    return {
      answer: r.answer,
      sourceRefs: r.sources.map((s) => s.ref),
      stopReason: r.stopReason,
      calls: r.calls,
      latencyMs: r.latencyMs,
      meta: {
        domains: r.route.domains,
        tools: r.toolCalls.map((t) => t.name),
        unverified_citations: r.citations.unverified,
        skill_versions: r.skillVersions,
        ttft_ms: r.ttftMs,
      },
    }
  }
}

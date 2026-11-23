import type { ModelCall } from '@/lib/db/answer-logs'

export interface EvalCase {
  key: string
  domain: string
  language: string
  question: string
  context?: { role: 'user' | 'assistant'; content: string }[] | null
  expected?: string | null
  rubric: {
    key_points: string[]
    community_notes?: string
    pitfalls?: string[]
    difficulty?: string
    needs_practical_ruling?: boolean
    failed_before?: boolean
  }
  mustCite: string[]
}

/** What a system under test returns for one case. */
export interface TargetAnswer {
  answer: string
  sourceRefs: string[]
  stopReason: string | null
  calls: ModelCall[]
  latencyMs: number
  meta?: Record<string, unknown>
}

export type Target = (c: EvalCase) => Promise<TargetAnswer>

export interface JudgeScores {
  language_correct: boolean
  key_points_covered: boolean[]
  accuracy: number          // 1-5
  sourcing: number          // 1-5
  community_handling: number | null // 1-5, null if not community-dependent
  structure_tone: number    // 1-5
  pitfalls_hit: string[]
  cited_refs: string[]
  overall: number           // 1-5
  rationale: string
}

export interface CaseResult {
  key: string
  domain: string
  language: string
  passed: boolean
  scores: JudgeScores & {
    key_point_coverage: number
    must_cite_hit: number | null
    cited_refs_unresolved: string[]
    truncated: boolean
  }
  answer: string
  costUsd: number
  latencyMs: number
  error?: string
}

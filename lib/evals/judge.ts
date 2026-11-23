// LLM judge (Opus 5.5) + deterministic checks for one eval case.
import Anthropic from '@anthropic-ai/sdk'
import { JUDGE_MODEL, JUDGE_PANEL, estimateCost } from '@/lib/ai/models'
import { checkRef } from '@/lib/sefaria/verify'
import type { CaseResult, EvalCase, JudgeScores, TargetAnswer } from './types'

const LANG_NAMES: Record<string, string> = {
  en: 'English', he: 'Hebrew', fr: 'French', es: 'Spanish', ru: 'Russian', yi: 'Yiddish', pt: 'Portuguese', de: 'German',
}

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['language_correct', 'key_points_covered', 'accuracy', 'sourcing', 'community_handling', 'structure_tone',
    'pitfalls_hit', 'cited_refs', 'overall', 'rationale'],
  properties: {
    language_correct: { type: 'boolean', description: 'Answer prose is in the expected language (quoted Hebrew/Aramaic sources are fine)' },
    key_points_covered: { type: 'array', items: { type: 'boolean' }, description: 'One boolean per rubric key point, same order' },
    accuracy: { type: 'integer', description: '1-5. Factual and halachic correctness; 1 = contains a serious error' },
    sourcing: { type: 'integer', description: '1-5. Cites real, relevant, precise sources; penalize vague or invented citations' },
    community_handling: { type: ['integer', 'null'], description: '1-5 if the rubric has community notes, else null. Are differing practices correctly labeled?' },
    structure_tone: { type: 'integer', description: '1-5. Direct answer first, clear, respectful, appropriate length, rabbi referral for personal halacha' },
    pitfalls_hit: { type: 'array', items: { type: 'string' }, description: 'Rubric pitfalls (or other serious errors) the answer commits' },
    cited_refs: { type: 'array', items: { type: 'string' }, description: 'Every source the answer cites, normalized to Sefaria reference format (e.g. "Shulchan Arukh, Orach Chayim 263:1", "Shabbat 23b", "Rashi on Exodus 20:8:1"). Max 12.' },
    overall: { type: 'integer', description: '1-5 overall quality for a learned user' },
    rationale: { type: 'string', description: 'Two or three sentences explaining the scores' },
  },
}

const SYSTEM = `You are a strict, fair grader of answers from an AI Torah study assistant. You receive the user's question, a rubric written by a senior scholar, and the assistant's answer. Grade only what the answer says. Do not reward length. An answer that is fluent but contains a halachic error, an invented or misattributed source, or presents a minority view as mainstream must get accuracy ≤ 2 and overall ≤ 2.`


const normRef = (r: string) => r.toLowerCase().replace(/[^a-z0-9]/g, '')

export async function judgeCase(client: Anthropic, c: EvalCase, a: TargetAnswer): Promise<{ result: CaseResult; judgeCost: number }> {
  const truncated = a.stopReason !== 'end_turn'
  const prompt = `EXPECTED ANSWER LANGUAGE: ${LANG_NAMES[c.language] ?? c.language}

USER QUESTION:
${c.question}

RUBRIC
Key points (in order):
${c.rubric.key_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}
Community notes: ${c.rubric.community_notes || 'none'}
Pitfalls: ${(c.rubric.pitfalls ?? []).map((p) => `\n- ${p}`).join('') || 'none'}
Sources a good answer should cite: ${c.mustCite.join('; ') || 'none specified'}
Practical ruling requested: ${c.rubric.needs_practical_ruling ? 'yes' : 'no'}

ASSISTANT ANSWER${truncated ? ' (NOTE: answer was cut off before finishing)' : ''}:
${a.answer || '(empty)'}`

  // Grade with a panel of different models and average: a single judge favors answers from its own model.
  // JUDGE_OVERRIDE=<model> grades with that one model only.
  const models = process.env.JUDGE_OVERRIDE ? [process.env.JUDGE_OVERRIDE] : [...JUDGE_PANEL]
  let judgeCost = 0
  const panel = await Promise.all(models.map(async (model) => {
    const res = await client.messages.create({
      model,
      max_tokens: JUDGE_MODEL.maxTokens,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: scoreSchema } },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    judgeCost += estimateCost(res.model, res.usage) ?? 0
    return JSON.parse(res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')) as JudgeScores
  }))
  const mean = (f: (j: JudgeScores) => number) => panel.reduce((t, j) => t + f(j), 0) / panel.length
  const comm = panel.map((j) => j.community_handling).filter((v): v is number => v !== null)
  const s: JudgeScores = {
    language_correct: panel.every((j) => j.language_correct),
    // a key point counts as covered only if every judge says so
    key_points_covered: panel[0].key_points_covered.map((_, i) => panel.every((j) => j.key_points_covered[i] === true)),
    accuracy: mean((j) => j.accuracy),
    sourcing: mean((j) => j.sourcing),
    community_handling: comm.length ? comm.reduce((a, b) => a + b, 0) / comm.length : null,
    structure_tone: mean((j) => j.structure_tone),
    pitfalls_hit: [...new Set(panel.flatMap((j) => j.pitfalls_hit))],
    cited_refs: [...new Set(panel.flatMap((j) => j.cited_refs))].slice(0, 12),
    overall: mean((j) => j.overall),
    rationale: panel.map((j, i) => `[${models[i].replace('claude-', '')}] ${j.rationale}`).join(' '),
  }

  const covered = s.key_points_covered.filter(Boolean).length
  const keyPointCoverage = c.rubric.key_points.length ? covered / c.rubric.key_points.length : 1
  const cited = s.cited_refs.map(normRef)
  const mustCiteHit = c.mustCite.length
    ? c.mustCite.filter((r) => cited.some((x) => x.includes(normRef(r)) || normRef(r).includes(x))).length / c.mustCite.length
    : null
  const refs = s.cited_refs.slice(0, 12)
  const status = await Promise.all(refs.map((ref) => checkRef(ref)))
  const unresolved = refs.filter((_, i) => status[i] === 'invalid')

  const passed =
    // any judge seeing a serious error (accuracy <= 2) fails the case
    !truncated && s.language_correct && s.overall >= 3.75 && s.accuracy >= 3.75 && keyPointCoverage >= 0.6 && panel.every((j) => j.accuracy > 2)

  return {
    judgeCost,
    result: {
      key: c.key,
      domain: c.domain,
      language: c.language,
      passed,
      scores: { ...s, key_point_coverage: keyPointCoverage, must_cite_hit: mustCiteHit, cited_refs_unresolved: unresolved, truncated },
      answer: a.answer,
      costUsd: 0,
      latencyMs: a.latencyMs,
    },
  }
}

// Draft eval cases (rubrics) from selected candidates using Claude Opus 5.5 via the Batches API.
//   scripts/dev-local.sh npx tsx analysis/scripts/draft-evals.ts submit
//   scripts/dev-local.sh npx tsx analysis/scripts/draft-evals.ts collect <batch_id>
// Input:  analysis/data/eval-candidates.jsonl (private, from select-evals.cjs)
// Output: evals/cases.jsonl (committable: questions are scrubbed of personal details)
//         evals/halacha-review.md (review sheet for owner + rabbi)
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import { JUDGE_MODEL } from '@/lib/ai/models'
import { getTexts } from '@/lib/sefaria/client'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const D = 'analysis/data'

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['standalone', 'question_clean', 'key_points', 'must_cite', 'community_notes', 'pitfalls', 'difficulty'],
  properties: {
    standalone: { type: 'boolean', description: 'False if the message only makes sense as a follow-up to an earlier conversation, or is not a real question' },
    question_clean: { type: 'string', description: 'The question with personal details removed (names, places, health, family specifics), same language, otherwise as close to the original wording as possible' },
    key_points: { type: 'array', items: { type: 'string' }, description: '3-7 points a correct, complete answer must contain' },
    must_cite: { type: 'array', items: { type: 'string' }, description: '0-5 primary sources a good answer should cite, in Sefaria reference format, e.g. "Shulchan Arukh, Orach Chayim 253:1", "Berakhot 26b", "Genesis 22:2", "Rashi on Genesis 1:1:1". Only sources you are confident exist and are on point.' },
    community_notes: { type: 'string', description: 'If practice differs by community (Ashkenazi, Sephardi, Chabad, etc.), state the differences; else ""' },
    pitfalls: { type: 'array', items: { type: 'string' }, description: 'Specific errors a weak answer might make (invented sources, presenting a minority view as mainstream, wrong attribution, wrong language)' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
}

const SYSTEM = `You are a senior Torah scholar building an evaluation set for an AI Torah study assistant. For each user question you receive, write a grading rubric that a judge will use to score the assistant's answer.

Rules:
- The assistant must answer in the user's language; quoted sources may be in Hebrew/Aramaic with translation.
- Key points: what a knowledgeable, balanced answer must say. Where there is a machloket, the key points must name the main positions and who holds them, and which is the accepted practice where relevant.
- For practical halacha: a good answer gives the mainstream ruling with sources, notes community differences, and recommends consulting a rabbi for personal application.
- must_cite: only real, precisely referenced sources you are confident about. Fewer correct references are better than many doubtful ones.
- Mark standalone=false for messages that depend on missing earlier conversation ("and without the a?", "what about the second one?") or are not genuine questions.
- question_clean: remove anything identifying (personal names, specific family or health circumstances become generic). Do not otherwise improve or translate the question.`

interface Candidate {
  source_id: string; eval_domain: string; corpus_domain: string; sub_topic: string; shape: string; language: string
  failed_before: boolean; needs_practical_ruling: boolean; community_dependent: boolean; target: number; rank: number; question: string
}

const cut = (s: string, n: number) =>
  Array.from(s).slice(0, n).join('').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')

function candidates(): Candidate[] {
  return fs.readFileSync(`${D}/eval-candidates.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

async function submit() {
  const cs = candidates()
  const requests = cs.map((c, i) => ({
    custom_id: `c${i}`,
    params: {
      model: JUDGE_MODEL.model,
      max_tokens: JUDGE_MODEL.maxTokens,
      output_config: { effort: 'medium' as const, format: { type: 'json_schema' as const, schema } },
      system: SYSTEM,
      messages: [{
        role: 'user' as const,
        content: `Domain: ${c.eval_domain} (${c.corpus_domain}, ${c.sub_topic})\nUser language: ${c.language}\nAsks for a practical ruling: ${c.needs_practical_ruling}\nCommunity-dependent: ${c.community_dependent}\n\nUSER QUESTION:\n${cut(c.question, 2500)}`,
      }],
    },
  }))
  const batch = await client.messages.batches.create({ requests } as Anthropic.Messages.BatchCreateParams)
  fs.writeFileSync(`${D}/draft-evals-batch.json`, JSON.stringify({ id: batch.id, n: requests.length }))
  console.log('batch', batch.id, requests.length, 'requests')
}

async function refResolves(ref: string): Promise<boolean> {
  try {
    const t = await getTexts(ref, { version: 'primary' })
    return !!t && !(t as { error?: string }).error
  } catch {
    return false
  }
}

async function collect(id: string) {
  for (;;) {
    const b = await client.messages.batches.retrieve(id)
    console.log(new Date().toISOString(), b.processing_status, JSON.stringify(b.request_counts))
    if (b.processing_status === 'ended') break
    await new Promise((r) => setTimeout(r, 60_000))
  }
  const cs = candidates()
  const drafts: Record<number, Record<string, unknown>> = {}
  let inTok = 0, outTok = 0
  for await (const r of await client.messages.batches.results(id)) {
    if (r.result.type !== 'succeeded') continue
    const m = r.result.message
    inTok += m.usage.input_tokens; outTok += m.usage.output_tokens
    if (m.stop_reason !== 'end_turn') continue
    const txt = m.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('')
    try { drafts[Number(r.custom_id.slice(1))] = JSON.parse(txt) } catch { /* skip */ }
  }
  console.log(`drafted ${Object.keys(drafts).length}/${cs.length}; cost ≈ $${((inTok * 4 + outTok * 20) / 1e6 / 2).toFixed(2)}`)

  // Keep the first `target` standalone cases per domain (by selection rank), verify refs against Sefaria.
  const kept: unknown[] = []
  let refsTotal = 0, refsDropped = 0
  const byDomain: Record<string, number> = {}
  for (const [i, c] of cs.entries()) {
    const d = drafts[i] as { standalone: boolean; question_clean: string; key_points: string[]; must_cite: string[]; community_notes: string; pitfalls: string[]; difficulty: string } | undefined
    if (!d?.standalone) continue
    if ((byDomain[c.eval_domain] ?? 0) >= c.target) continue
    const verified: string[] = []
    for (const ref of d.must_cite) {
      refsTotal++
      if (await refResolves(ref)) verified.push(ref); else refsDropped++
    }
    byDomain[c.eval_domain] = (byDomain[c.eval_domain] ?? 0) + 1
    kept.push({
      id: `${c.eval_domain}-${String(byDomain[c.eval_domain]).padStart(3, '0')}`,
      domain: c.eval_domain,
      language: c.language,
      question: d.question_clean,
      expected: d.key_points.map((p) => `- ${p}`).join('\n'),
      rubric: {
        key_points: d.key_points,
        community_notes: d.community_notes,
        pitfalls: d.pitfalls,
        difficulty: d.difficulty,
        needs_practical_ruling: c.needs_practical_ruling,
        failed_before: c.failed_before,
      },
      must_cite: verified,
      source: 'corpus',
      status: c.eval_domain === 'halacha_minhag' ? 'draft' : 'approved',
    })
  }
  fs.mkdirSync('evals', { recursive: true })
  fs.writeFileSync('evals/cases.jsonl', kept.map((k) => JSON.stringify(k)).join('\n') + '\n')
  console.log('kept per domain', byDomain, `refs verified ${refsTotal - refsDropped}/${refsTotal}`)

  // Review sheet for owner + rabbi (halacha & minhag)
  type K = { id: string; language: string; question: string; rubric: { key_points: string[]; community_notes: string; pitfalls: string[] }; must_cite: string[] }
  const hal = (kept as K[]).filter((k) => k.id.startsWith('halacha_minhag'))
  let md = `# Halacha & Minhag eval review sheet\n\nFor review by the owner and a rabbi. For each case, correct the **key points** (what a good answer must say), the **community notes**, and the **sources**. Mark each case ✅ approved, ✏️ corrected, or ❌ drop. Corrections here become the grading standard for the AI.\n\n`
  for (const k of hal) {
    md += `---\n\n## ${k.id} (${k.language})\n\n**Question:** ${k.question}\n\n**Key points a good answer must contain:**\n${k.rubric.key_points.map((p) => `- ${p}`).join('\n')}\n\n`
    md += `**Community differences:** ${k.rubric.community_notes || '—'}\n\n**Sources it should cite:** ${k.must_cite.join('; ') || '—'}\n\n**Mistakes to penalize:**\n${k.rubric.pitfalls.map((p) => `- ${p}`).join('\n')}\n\n**Review:** ☐ approve ☐ corrected ☐ drop   Notes: \n\n`
  }
  fs.writeFileSync('evals/halacha-review.md', md)
  console.log(`wrote evals/cases.jsonl (${kept.length}) and evals/halacha-review.md (${hal.length})`)
}

const [cmd, arg] = process.argv.slice(2)
;(cmd === 'submit' ? submit() : collect(arg)).catch((e) => { console.error('ERR', e.status ?? '', e.message); process.exit(1) })

// Eval runner CLI.
//   npm run eval -- --target legacy|agent [--domain halacha_minhag] [--lang fr] [--limit 10] [--split train|test]
//                   [--concurrency 8] [--skill domain-halacha_minhag@3,shared-calendar@2]
// Cases: evals/cases.jsonl + approved correction cases from the DB. Results go to eval_runs/eval_results and
// evals/runs/<timestamp>-<target>.md (summary) + .jsonl (per-case).
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import { legacyTarget } from '@/lib/evals/targets/legacy'
import { agentTarget } from '@/lib/evals/targets/agent'
import { loadSkillVersion, type LoadedSkill } from '@/lib/agent/skills'
import { loadAllCases, renderReport, runCases } from '@/lib/evals/runner'
import type { Target } from '@/lib/evals/types'

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1] ?? '']] : acc), []),
)
const TARGET = args.target ?? 'legacy'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getTarget(name: string): Promise<Target> {
  if (name === 'legacy') return legacyTarget(client)
  if (name === 'agent') {
    const overrides: Record<string, LoadedSkill> = {}
    for (const spec of (args.skill ?? '').split(',').filter(Boolean)) {
      const [slug, v] = spec.split('@')
      const s = await loadSkillVersion(slug, Number(v))
      if (!s) throw new Error(`skill version not found: ${spec}`)
      overrides[slug] = s
    }
    return agentTarget(client, overrides)
  }
  throw new Error(`unknown target ${name}`)
}

async function main() {
  const cases = await loadAllCases({
    domain: args.domain, lang: args.lang, limit: args.limit ? Number(args.limit) : undefined,
    split: args.split === 'train' || args.split === 'test' ? args.split : undefined,
  }, args.cases)
  const target = await getTarget(TARGET)
  console.log(`running ${cases.length} cases on target=${TARGET}`)
  const { results, summary, answerCost, judgeCost } = await runCases(client, target, cases, {
    target: TARGET, config: { args }, concurrency: Number(args.concurrency ?? 8),
    onProgress: (d, t, r) => process.stdout.write(`\r${d}/${t} ${r.error ? 'ERR ' + r.key + ': ' + r.error.slice(0, 80) + '\n' : ''}`),
  })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  fs.mkdirSync('evals/runs', { recursive: true })
  const base = `evals/runs/${stamp}-${TARGET}${args.split ? '-' + args.split : ''}`
  const md = renderReport(`Eval run: ${TARGET} · ${new Date().toISOString().slice(0, 16)}`, results, summary,
    { answers: answerCost, judge: judgeCost }, `Args: \`${JSON.stringify(args)}\` · `)
  fs.writeFileSync(`${base}.md`, md)
  fs.writeFileSync(`${base}.jsonl`, results.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`\n${md}\nwrote ${base}.md`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

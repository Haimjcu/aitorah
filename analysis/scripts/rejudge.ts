// Re-grade saved eval answers with a different judge model (checks judge self-preference bias).
//   JUDGE_OVERRIDE=claude-sonnet-5-5 scripts/dev-local.sh npx tsx analysis/scripts/rejudge.ts label=run.jsonl ...
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import { judgeCase } from '@/lib/evals/judge'
import { loadFileCases } from '@/lib/evals/runner'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function main() {
  const cases = Object.fromEntries(loadFileCases().map((c) => [c.key, c]))
  const runs = process.argv.slice(2).map((a) => { const [label, f] = a.split('='); return { label, rows: fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => !r.error) } })
  const shared = runs[0].rows.map((r: { key: string }) => r.key).filter((k: string) => runs.every((run) => run.rows.some((r: { key: string }) => r.key === k)))
  for (const run of runs) {
    const scores = await Promise.all(shared.map(async (k: string) => {
      const r = run.rows.find((x: { key: string }) => x.key === k)
      const { result } = await judgeCase(client, cases[k], { answer: r.answer, sourceRefs: [], stopReason: r.scores.truncated ? 'max_tokens' : 'end_turn', calls: [], latencyMs: 0 })
      return result
    }))
    const avg = (f: (x: (typeof scores)[number]) => number) => (scores.reduce((s, x) => s + f(x), 0) / scores.length).toFixed(2)
    console.log(`${run.label.padEnd(12)} n ${scores.length} pass ${(scores.filter((s) => s.passed).length / scores.length * 100).toFixed(0)}% accuracy ${avg((s) => s.scores.accuracy)} overall ${avg((s) => s.scores.overall)} sourcing ${avg((s) => s.scores.sourcing)} serious ${scores.filter((s) => s.scores.accuracy <= 2).length}`)
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })

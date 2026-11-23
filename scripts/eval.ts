// Eval runner.
//   scripts/dev-local.sh npx tsx scripts/eval.ts --target legacy [--domain halacha_minhag] [--limit 10] [--concurrency 4] [--lang fr]
// Reads evals/cases.jsonl (source of truth), syncs cases into eval_cases, records eval_runs/eval_results,
// and writes evals/runs/<timestamp>-<target>.md (summary) + .jsonl (per-case results).
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { evalCases, evalRuns, evalResults } from '@/lib/db/schema'
import { estimateCost } from '@/lib/ai/models'
import { legacyTarget } from '@/lib/evals/targets/legacy'
import { agentTarget } from '@/lib/evals/targets/agent'
import { judgeCase } from '@/lib/evals/judge'
import type { CaseResult, EvalCase, Target } from '@/lib/evals/types'

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1] ?? '']] : acc), []),
)
const TARGET = args.target ?? 'legacy'
const CONCURRENCY = Number(args.concurrency ?? 4)
const hasDb = !!process.env.DATABASE_URL
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getTarget(name: string): Promise<Target> {
  if (name === 'legacy') return legacyTarget(client)
  if (name === 'agent') return agentTarget(client)
  throw new Error(`unknown target ${name}`)
}

interface FileCase {
  id: string; domain: string; language: string; question: string; expected?: string
  rubric: EvalCase['rubric']; must_cite: string[]; source: string; status: string; context?: EvalCase['context']
}

function loadCases(): EvalCase[] {
  const rows: FileCase[] = fs.readFileSync(args.cases ?? 'evals/cases.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return rows
    .filter((r) => r.status !== 'retired')
    .filter((r) => !args.domain || r.domain === args.domain)
    .filter((r) => !args.lang || r.language === args.lang)
    .slice(0, args.limit ? Number(args.limit) : undefined)
    .map((r) => ({ key: r.id, domain: r.domain, language: r.language, question: r.question, context: r.context ?? null,
      expected: r.expected ?? null, rubric: r.rubric, mustCite: r.must_cite ?? [] }))
}

async function syncCases(cases: EvalCase[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  if (!hasDb) return ids
  const db = getDb()
  const fileRows: FileCase[] = fs.readFileSync(args.cases ?? 'evals/cases.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const statusByKey = new Map(fileRows.map((r) => [r.id, r.status]))
  for (const c of cases) {
    const [row] = await db.insert(evalCases).values({
      key: c.key, domain: c.domain, language: c.language, question: c.question, context: c.context ?? null,
      expected: c.expected ?? null, rubric: c.rubric, mustCite: c.mustCite, source: 'corpus', status: statusByKey.get(c.key) ?? 'draft',
    }).onConflictDoUpdate({
      target: evalCases.key,
      set: { question: c.question, expected: c.expected ?? null, rubric: c.rubric, mustCite: c.mustCite, status: sql`excluded.status` },
    }).returning({ id: evalCases.id })
    ids.set(c.key, row.id)
  }
  return ids
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i) }
  }))
  return out
}

function summarize(results: CaseResult[]) {
  const group = (key: (r: CaseResult) => string) => {
    const g: Record<string, CaseResult[]> = {}
    for (const r of results) (g[key(r)] ||= []).push(r)
    return Object.fromEntries(Object.entries(g).map(([k, rs]) => {
      const ok = rs.filter((r) => !r.error)
      const avg = (f: (r: CaseResult) => number) => ok.length ? ok.reduce((s, r) => s + f(r), 0) / ok.length : 0
      return [k, {
        n: rs.length, errors: rs.length - ok.length,
        pass_rate: ok.length ? ok.filter((r) => r.passed).length / ok.length : 0,
        overall: avg((r) => r.scores.overall), accuracy: avg((r) => r.scores.accuracy), sourcing: avg((r) => r.scores.sourcing),
        key_point_coverage: avg((r) => r.scores.key_point_coverage),
        language_ok: avg((r) => (r.scores.language_correct ? 1 : 0)),
        unresolved_refs_per_answer: avg((r) => r.scores.cited_refs_unresolved.length),
        truncated: ok.filter((r) => r.scores.truncated).length,
        latency_s: avg((r) => r.latencyMs) / 1000,
        cost_per_answer: avg((r) => r.costUsd),
      }]
    }))
  }
  return { all: group(() => 'all').all, by_domain: group((r) => r.domain), by_language: group((r) => r.language) }
}

function table(title: string, rows: Record<string, ReturnType<typeof summarize>['all']>) {
  const f = (x: number, d = 2) => x.toFixed(d)
  let md = `\n### ${title}\n\n| | n | pass | overall | accuracy | sourcing | key pts | lang ok | bad refs/ans | truncated | latency s | $/answer |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`
  for (const [k, s] of Object.entries(rows)) {
    md += `| ${k} | ${s.n}${s.errors ? ` (${s.errors} err)` : ''} | ${f(s.pass_rate * 100, 0)}% | ${f(s.overall)} | ${f(s.accuracy)} | ${f(s.sourcing)} | ${f(s.key_point_coverage * 100, 0)}% | ${f(s.language_ok * 100, 0)}% | ${f(s.unresolved_refs_per_answer)} | ${s.truncated} | ${f(s.latency_s, 1)} | ${f(s.cost_per_answer, 3)} |\n`
  }
  return md
}

async function main() {
  const cases = loadCases()
  const target = await getTarget(TARGET)
  console.log(`running ${cases.length} cases on target=${TARGET} concurrency=${CONCURRENCY}`)
  const caseIds = await syncCases(cases)
  const db = hasDb ? getDb() : null
  const [run] = db
    ? await db.insert(evalRuns).values({ target: TARGET, config: { args, cases: cases.length } }).returning({ id: evalRuns.id })
    : [{ id: 'no-db' }]

  let judgeTotal = 0, done = 0
  const results = await pool(cases, CONCURRENCY, async (c) => {
    let r: CaseResult
    try {
      const a = await getTargetAnswerWithRetry(target, c)
      const { result, judgeCost } = await judgeCase(client, c, a)
      judgeTotal += judgeCost
      r = { ...result, costUsd: a.calls.reduce((s, x) => s + (estimateCost(x.model, x.usage) ?? 0), 0) }
    } catch (e) {
      r = { key: c.key, domain: c.domain, language: c.language, passed: false, answer: '', costUsd: 0, latencyMs: 0,
        error: (e as Error).message, scores: {} as CaseResult['scores'] }
    }
    if (db && caseIds.get(c.key)) {
      await db.insert(evalResults).values({ runId: run.id, caseId: caseIds.get(c.key)!, answer: r.answer, scores: r.error ? { error: r.error } : r.scores,
        passed: r.passed, costUsd: r.costUsd, latencyMs: r.latencyMs })
    }
    done++
    process.stdout.write(`\r${done}/${cases.length} ${r.error ? 'ERR ' + r.key + ': ' + r.error.slice(0, 80) + '\n' : ''}`)
    return r
  })

  const summary = summarize(results)
  const answerCost = results.reduce((s, r) => s + r.costUsd, 0)
  if (db) await db.update(evalRuns).set({ summary, costUsd: answerCost + judgeTotal, finishedAt: new Date() }).where(eq(evalRuns.id, run.id))

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  fs.mkdirSync('evals/runs', { recursive: true })
  const base = `evals/runs/${stamp}-${TARGET}`
  let md = `# Eval run: ${TARGET} · ${new Date().toISOString().slice(0, 16)}\n\nCases: ${cases.length} · Args: \`${JSON.stringify(args)}\` · Cost: answers $${answerCost.toFixed(2)} + judge $${judgeTotal.toFixed(2)}\n\nPass = not truncated, correct language, overall ≥ 4, accuracy ≥ 4, key-point coverage ≥ 60%.\n`
  md += table('Overall', { all: summary.all }) + table('By domain', summary.by_domain) + table('By language', summary.by_language)
  const worst = results.filter((r) => !r.error && !r.passed).sort((a, b) => a.scores.overall - b.scores.overall).slice(0, 10)
  md += `\n### Lowest-scoring cases\n\n` + worst.map((r) => `- **${r.key}** (${r.language}) overall ${r.scores.overall}, accuracy ${r.scores.accuracy}: ${r.scores.rationale}`).join('\n') + '\n'
  fs.writeFileSync(`${base}.md`, md)
  fs.writeFileSync(`${base}.jsonl`, results.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`\n${md}\nwrote ${base}.md`)
  process.exit(0)
}

async function getTargetAnswerWithRetry(target: Target, c: EvalCase) {
  for (let attempt = 0; ; attempt++) {
    try { return await target(c) } catch (e) {
      if (attempt >= 2 || !(e instanceof Anthropic.APIError && (e.status === 429 || (e.status ?? 0) >= 500))) throw e
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

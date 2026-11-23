// Shared eval runner (used by scripts/eval.ts and the learning loop).
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import crypto from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { evalCases, evalResults, evalRuns } from '@/lib/db/schema'
import { estimateCost } from '@/lib/ai/models'
import { judgeCase } from './judge'
import type { CaseResult, EvalCase, Target } from './types'

const hasDb = () => !!process.env.DATABASE_URL

export interface CaseFilter {
  domain?: string
  domains?: string[]
  lang?: string
  limit?: number
  /** Deterministic 50/50 split by case key: tune skills on 'train', report on 'test'. */
  split?: 'train' | 'test'
}

interface FileCase {
  id: string; domain: string; language: string; question: string; expected?: string
  rubric: EvalCase['rubric']; must_cite: string[]; source: string; status: string; context?: EvalCase['context']
}

export const caseSplit = (key: string): 'train' | 'test' =>
  crypto.createHash('sha1').update(key).digest()[0] % 2 === 0 ? 'train' : 'test'

function applyFilter(cases: EvalCase[], f: CaseFilter) {
  return cases
    .filter((c) => !f.domain || c.domain === f.domain)
    .filter((c) => !f.domains || f.domains.includes(c.domain))
    .filter((c) => !f.lang || c.language === f.lang)
    .filter((c) => !f.split || caseSplit(c.key) === f.split)
    .slice(0, f.limit)
}

function readFileRows(path = 'evals/cases.jsonl'): FileCase[] {
  return fs.readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

export function loadFileCases(f: CaseFilter = {}, path?: string): EvalCase[] {
  const cases = readFileRows(path)
    .filter((r) => r.status !== 'retired')
    .map((r) => ({ key: r.id, domain: r.domain, language: r.language, question: r.question, context: r.context ?? null,
      expected: r.expected ?? null, rubric: r.rubric, mustCite: r.must_cite ?? [] }))
  return applyFilter(cases, f)
}

/** Approved cases created from user corrections (stored only in the DB). */
export async function loadCorrectionCases(f: CaseFilter = {}): Promise<EvalCase[]> {
  if (!hasDb()) return []
  const rows = await getDb().select().from(evalCases).where(and(eq(evalCases.source, 'correction'), eq(evalCases.status, 'approved')))
  return applyFilter(rows.map((r) => ({
    key: r.key, domain: r.domain, language: r.language, question: r.question,
    context: (r.context as EvalCase['context']) ?? null, expected: r.expected, rubric: r.rubric as EvalCase['rubric'], mustCite: r.mustCite ?? [],
  })), f)
}

export async function loadAllCases(f: CaseFilter = {}, path?: string) {
  const fileCases = loadFileCases({ ...f, limit: undefined }, path)
  const corrCases = await loadCorrectionCases({ ...f, limit: undefined })
  return [...fileCases, ...corrCases].slice(0, f.limit)
}

/** Upsert file cases into eval_cases; returns key → id. */
export async function syncCases(cases: EvalCase[], path?: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  if (!hasDb()) return ids
  const db = getDb()
  const statusByKey = new Map(readFileRows(path).map((r) => [r.id, r.status]))
  for (const c of cases) {
    const fromFile = statusByKey.has(c.key)
    const [row] = await db.insert(evalCases).values({
      key: c.key, domain: c.domain, language: c.language, question: c.question, context: c.context ?? null,
      expected: c.expected ?? null, rubric: c.rubric, mustCite: c.mustCite, source: fromFile ? 'corpus' : 'correction',
      status: statusByKey.get(c.key) ?? 'approved',
    }).onConflictDoUpdate({
      target: evalCases.key,
      set: fromFile
        ? { question: c.question, expected: c.expected ?? null, rubric: c.rubric, mustCite: c.mustCite, status: sql`excluded.status` }
        : { question: c.question },
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

async function answerWithRetry(target: Target, c: EvalCase) {
  for (let attempt = 0; ; attempt++) {
    try { return await target(c) } catch (e) {
      if (attempt >= 2 || !(e instanceof Anthropic.APIError && (e.status === 429 || (e.status ?? 0) >= 500))) throw e
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
}

export type Summary = ReturnType<typeof summarize>

export function summarize(results: CaseResult[]) {
  const group = (key: (r: CaseResult) => string) => {
    const g: Record<string, CaseResult[]> = {}
    for (const r of results) (g[key(r)] ||= []).push(r)
    return Object.fromEntries(Object.entries(g).map(([k, rs]) => {
      const ok = rs.filter((r) => !r.error)
      const avg = (f: (r: CaseResult) => number) => (ok.length ? ok.reduce((s, r) => s + f(r), 0) / ok.length : 0)
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

export interface RunOptions {
  target: string
  config?: Record<string, unknown>
  concurrency?: number
  onProgress?: (done: number, total: number, r: CaseResult) => void
}

export async function runCases(client: Anthropic, target: Target, cases: EvalCase[], opts: RunOptions) {
  const caseIds = await syncCases(cases)
  const db = hasDb() ? getDb() : null
  const [run] = db
    ? await db.insert(evalRuns).values({ target: opts.target, config: { ...opts.config, cases: cases.length } }).returning({ id: evalRuns.id })
    : [{ id: 'no-db' }]
  let judgeCost = 0, done = 0
  const results = await pool(cases, opts.concurrency ?? 8, async (c) => {
    let r: CaseResult
    try {
      const a = await answerWithRetry(target, c)
      const j = await judgeCase(client, c, a)
      judgeCost += j.judgeCost
      r = { ...j.result, costUsd: a.calls.reduce((s, x) => s + (estimateCost(x.model, x.usage) ?? 0), 0) }
    } catch (e) {
      r = { key: c.key, domain: c.domain, language: c.language, passed: false, answer: '', costUsd: 0, latencyMs: 0,
        error: (e as Error).message, scores: {} as CaseResult['scores'] }
    }
    if (db && caseIds.get(c.key)) {
      await db.insert(evalResults).values({ runId: run.id, caseId: caseIds.get(c.key)!, answer: r.answer,
        scores: r.error ? { error: r.error } : r.scores, passed: r.passed, costUsd: r.costUsd, latencyMs: r.latencyMs })
    }
    opts.onProgress?.(++done, cases.length, r)
    return r
  })
  const summary = summarize(results)
  const answerCost = results.reduce((s, r) => s + r.costUsd, 0)
  if (db) await db.update(evalRuns).set({ summary, costUsd: answerCost + judgeCost, finishedAt: new Date() }).where(eq(evalRuns.id, run.id))
  return { runId: run.id, results, summary, answerCost, judgeCost }
}

function table(title: string, rows: Record<string, Summary['all']>) {
  const f = (x: number, d = 2) => x.toFixed(d)
  let md = `\n### ${title}\n\n| | n | pass | overall | accuracy | sourcing | key pts | lang ok | bad refs/ans | truncated | latency s | $/answer |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`
  for (const [k, s] of Object.entries(rows)) {
    md += `| ${k} | ${s.n}${s.errors ? ` (${s.errors} err)` : ''} | ${f(s.pass_rate * 100, 0)}% | ${f(s.overall)} | ${f(s.accuracy)} | ${f(s.sourcing)} | ${f(s.key_point_coverage * 100, 0)}% | ${f(s.language_ok * 100, 0)}% | ${f(s.unresolved_refs_per_answer)} | ${s.truncated} | ${f(s.latency_s, 1)} | ${f(s.cost_per_answer, 3)} |\n`
  }
  return md
}

export function renderReport(title: string, results: CaseResult[], summary: Summary, cost: { answers: number; judge: number }, note = '') {
  let md = `# ${title}\n\n${note}Cases: ${results.length} · Cost: answers $${cost.answers.toFixed(2)} + judge $${cost.judge.toFixed(2)}\n\nScores are averaged over a two-model judge panel (Opus 5.5 + Sonnet 5.5). Pass = not truncated, correct language, overall ≥ 3.75, accuracy ≥ 3.75, key-point coverage ≥ 60% (a point counts only if both judges agree), and no judge finds a serious error (accuracy ≤ 2).\n`
  md += table('Overall', { all: summary.all }) + table('By domain', summary.by_domain) + table('By language', summary.by_language)
  const worst = results.filter((r) => !r.error && !r.passed).sort((a, b) => a.scores.overall - b.scores.overall).slice(0, 10)
  md += `\n### Lowest-scoring cases\n\n` + worst.map((r) => `- **${r.key}** (${r.language}) overall ${r.scores.overall}, accuracy ${r.scores.accuracy}: ${r.scores.rationale}`).join('\n') + '\n'
  return md
}

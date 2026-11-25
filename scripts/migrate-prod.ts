// Apply pending drizzle/*.sql migrations to a database, safely, whether or not it was set up with `drizzle-kit push`.
//
//   DATABASE_URL=... npx tsx scripts/migrate-prod.ts            # report only (read-only)
//   DATABASE_URL=... npx tsx scripts/migrate-prod.ts --apply    # apply pending migrations in ONE transaction
//
// Production was originally set up with `drizzle-kit push`, so it may have no drizzle.__drizzle_migrations table.
// In that case, if the objects from migrations 0000–0002 already exist, they are recorded as applied (baseline)
// and only the later ones run. Records use the same hash as drizzle-kit, so `drizzle-kit migrate` works afterwards.
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

const APPLY = process.argv.includes('--apply')
const DIR = path.join(process.cwd(), 'drizzle')
/** Migrations a push-based database already contains, and an object that proves each one is there. */
const BASELINE: Record<string, string> = {
  '0000_fuzzy_tombstone': `select to_regclass('public.qa_pairs') is not null as ok`,
  '0001_chilly_earthquake': `select to_regclass('public.users') is not null and to_regclass('public.study_sessions') is not null as ok`,
  '0002_normal_triathlon': `select exists(select 1 from information_schema.columns where table_name='qa_pairs' and column_name='status') as ok`,
}
/** An object each later migration creates: if it already exists, the database is in a partial state and we stop. */
const MARKERS: Record<string, string> = {
  '0003_agent_platform': `select to_regclass('public.projects') is not null or to_regclass('public.user_profiles') is not null as ok`,
  '0004_eval_case_key': `select exists(select 1 from information_schema.columns where table_name='eval_cases' and column_name='key') as ok`,
  '0005_corrections_snapshot': `select exists(select 1 from information_schema.columns where table_name='corrections' and column_name='question') as ok`,
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const journal = JSON.parse(fs.readFileSync(path.join(DIR, 'meta/_journal.json'), 'utf8')) as { entries: { tag: string; when: number }[] }
  const migrations = journal.entries.map((e) => {
    const sql = fs.readFileSync(path.join(DIR, `${e.tag}.sql`), 'utf8')
    return { tag: e.tag, when: e.when, sql, hash: crypto.createHash('sha256').update(sql).digest('hex') }
  })

  const db = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } })
  await db.connect()
  const q = async (sql: string) => (await db.query(sql)).rows
  console.log(`Database: ${new URL(url).hostname}:${new URL(url).port}${new URL(url).pathname}`)

  try {
    const hasJournal = (await q(`select to_regclass('drizzle.__drizzle_migrations') is not null as ok`))[0].ok as boolean
    const recorded = new Set(hasJournal ? (await q(`select hash from drizzle.__drizzle_migrations`)).map((r) => r.hash as string) : [])
    console.log(hasJournal ? `Migration journal found: ${recorded.size} recorded.` : 'No migration journal (database was set up with drizzle-kit push).')

    const baseline: typeof migrations = []
    const pending: typeof migrations = []
    for (const m of migrations) {
      if (recorded.has(m.hash)) { console.log(`  ✓ ${m.tag}: applied`); continue }
      if (BASELINE[m.tag]) {
        const ok = (await q(BASELINE[m.tag]))[0].ok
        if (!ok) throw new Error(`${m.tag} is not recorded and its objects are missing. Stop and investigate; do not apply.`)
        console.log(`  ✓ ${m.tag}: present (will be recorded as applied)`)
        baseline.push(m)
        continue
      }
      if (MARKERS[m.tag] && (await q(MARKERS[m.tag]))[0].ok) {
        throw new Error(`${m.tag} is not recorded but some of its objects already exist (partial state). Stop and investigate.`)
      }
      console.log(`  → ${m.tag}: PENDING (${m.sql.split('--> statement-breakpoint').length} statements)`)
      pending.push(m)
    }

    if (!pending.length && !baseline.length) { console.log('\nNothing to do: the database is up to date.'); return }
    if (!APPLY) { console.log(`\nReport only. Re-run with --apply to apply ${pending.length} migration(s) in one transaction.`); return }

    await q('BEGIN')
    await q(`CREATE SCHEMA IF NOT EXISTS drizzle`)
    await q(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`)
    for (const m of baseline) await db.query(`insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)`, [m.hash, m.when])
    for (const m of pending) {
      for (const stmt of m.sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)) await q(stmt)
      await db.query(`insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)`, [m.hash, m.when])
      console.log(`  applied ${m.tag}`)
    }
    await q('COMMIT')
    console.log(`\nDone: ${pending.length} migration(s) applied, ${baseline.length} recorded as already present.`)
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await db.end()
  }
}

main().catch((e) => { console.error(`\nFAILED (nothing was changed): ${e.message}`); process.exit(1) })

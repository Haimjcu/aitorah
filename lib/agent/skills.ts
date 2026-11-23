// Skill loader. Active skill versions come from Postgres (skills / skill_versions), editable without a deploy.
// Seed content lives in skills/*.md; it is used when the DB has no active version (fresh DB, no DATABASE_URL).
import fs from 'fs'
import path from 'path'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { skills, skillVersions } from '@/lib/db/schema'
import type { SharedSkill, SpecialistDomain } from './router'

export interface LoadedSkill {
  slug: string
  version: number | 'file'
  content: string
}

const SKILLS_DIR = path.join(process.cwd(), 'skills')
const hasDb = !!process.env.DATABASE_URL

// Short in-process cache so each request doesn't hit the DB; edits apply within a minute.
let cache: { at: number; bySlug: Map<string, LoadedSkill> } | null = null
const TTL_MS = 60_000

export function skillSlugs(domains: SpecialistDomain[], shared: SharedSkill[]): string[] {
  return [...domains.map((d) => `domain-${d}`), ...shared.map((s) => `shared-${s}`)]
}

function readFileSkill(slug: string): LoadedSkill | null {
  const p = path.join(SKILLS_DIR, `${slug}.md`)
  if (!fs.existsSync(p)) return null
  return { slug, version: 'file', content: fs.readFileSync(p, 'utf8') }
}

async function loadActiveFromDb(): Promise<Map<string, LoadedSkill>> {
  const map = new Map<string, LoadedSkill>()
  if (!hasDb) return map
  try {
    const rows = await getDb()
      .select({ slug: skills.slug, version: skillVersions.version, content: skillVersions.content })
      .from(skillVersions)
      .innerJoin(skills, eq(skills.id, skillVersions.skillId))
      .where(eq(skillVersions.status, 'active'))
    for (const r of rows) map.set(r.slug, { slug: r.slug, version: r.version, content: r.content })
  } catch (e) {
    console.error('skill load failed, using files:', (e as Error).message)
  }
  return map
}

export async function loadSkills(slugs: string[]): Promise<LoadedSkill[]> {
  if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), bySlug: await loadActiveFromDb() }
  const out: LoadedSkill[] = []
  for (const slug of slugs) {
    const s = cache.bySlug.get(slug) ?? readFileSkill(slug)
    if (s) out.push(s)
  }
  return out
}

/** For evals/admin: load a specific version (e.g. a draft under test) instead of the active one. */
export async function loadSkillVersion(slug: string, version: number): Promise<LoadedSkill | null> {
  if (!hasDb) return null
  const [row] = await getDb()
    .select({ content: skillVersions.content })
    .from(skillVersions)
    .innerJoin(skills, eq(skills.id, skillVersions.skillId))
    .where(and(eq(skills.slug, slug), eq(skillVersions.version, version)))
    .limit(1)
  return row ? { slug, version, content: row.content } : null
}

export function clearSkillCache() {
  cache = null
}


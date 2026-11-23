// Skill version management (admin UI, learning loop). Every change is a new version; activation retires the
// previous active version, so rollback = activate an older version.
import { and, asc, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { skills, skillVersions } from '@/lib/db/schema'
import { clearSkillCache } from './skills'

export async function listSkills() {
  const db = getDb()
  const rows = await db.select().from(skills).orderBy(asc(skills.kind), asc(skills.slug))
  const versions = await db.select({
    skillId: skillVersions.skillId, version: skillVersions.version, status: skillVersions.status,
    createdBy: skillVersions.createdBy, createdAt: skillVersions.createdAt, notes: skillVersions.notes,
  }).from(skillVersions).orderBy(desc(skillVersions.version))
  return rows.map((s) => {
    const vs = versions.filter((v) => v.skillId === s.id)
    return {
      ...s,
      activeVersion: vs.find((v) => v.status === 'active')?.version ?? null,
      latestVersion: vs[0]?.version ?? null,
      drafts: vs.filter((v) => v.status === 'draft').length,
      notes: vs.find((v) => v.status === 'active')?.notes ?? null,
    }
  })
}

export async function getSkill(slug: string) {
  const db = getDb()
  const [skill] = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1)
  if (!skill) return null
  const versions = await db.select().from(skillVersions).where(eq(skillVersions.skillId, skill.id)).orderBy(desc(skillVersions.version))
  return { skill, versions }
}

export async function createDraft(slug: string, content: string, createdBy: string, notes?: string | null) {
  const db = getDb()
  const found = await getSkill(slug)
  if (!found) throw new Error(`unknown skill ${slug}`)
  const version = (found.versions[0]?.version ?? 0) + 1
  const [row] = await db.insert(skillVersions).values({
    skillId: found.skill.id, version, content, status: 'draft', createdBy, notes: notes ?? null,
  }).returning()
  return row
}

export async function activateVersion(slug: string, version: number, by: string) {
  const db = getDb()
  const found = await getSkill(slug)
  if (!found) throw new Error(`unknown skill ${slug}`)
  const target = found.versions.find((v) => v.version === version)
  if (!target) throw new Error(`no version ${version} for ${slug}`)
  await db.transaction(async (tx) => {
    await tx.update(skillVersions).set({ status: 'retired' })
      .where(and(eq(skillVersions.skillId, found.skill.id), eq(skillVersions.status, 'active')))
    await tx.update(skillVersions)
      .set({ status: 'active', activatedAt: new Date(), notes: target.notes ? `${target.notes} · activated by ${by}` : `activated by ${by}` })
      .where(eq(skillVersions.id, target.id))
  })
  clearSkillCache()
}

export async function retireVersion(slug: string, version: number) {
  const db = getDb()
  const found = await getSkill(slug)
  if (!found) throw new Error(`unknown skill ${slug}`)
  await db.update(skillVersions).set({ status: 'retired' })
    .where(and(eq(skillVersions.skillId, found.skill.id), eq(skillVersions.version, version)))
  clearSkillCache()
}

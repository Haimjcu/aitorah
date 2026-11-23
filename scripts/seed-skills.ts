// Load skills/*.md into the skills / skill_versions tables.
//   scripts/dev-local.sh npx tsx scripts/seed-skills.ts            # new skills → v1 active; changed files → new draft version
//   scripts/dev-local.sh npx tsx scripts/seed-skills.ts --activate # also activate changed files (retires the previous active)
import fs from 'fs'
import path from 'path'
import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { skills, skillVersions } from '@/lib/db/schema'
import { clearSkillCache } from '@/lib/agent/skills'

const ACTIVATE = process.argv.includes('--activate')

async function main() {
  const db = getDb()
  const dir = path.join(process.cwd(), 'skills')
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const slug = file.replace(/\.md$/, '')
    const content = fs.readFileSync(path.join(dir, file), 'utf8')
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.replace(/^(Shared )?[Ss]kill:\s*/, '') ?? slug
    const kind = slug.startsWith('domain-') ? 'domain' : 'shared'
    const domain = kind === 'domain' ? slug.replace('domain-', '') : null

    let [skill] = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1)
    if (!skill) [skill] = await db.insert(skills).values({ slug, kind, domain, title }).returning()

    const [latest] = await db.select().from(skillVersions).where(eq(skillVersions.skillId, skill.id)).orderBy(desc(skillVersions.version)).limit(1)
    if (latest && latest.content === content) { console.log(`= ${slug} v${latest.version} unchanged`); continue }

    const version = (latest?.version ?? 0) + 1
    const activate = !latest || ACTIVATE
    if (activate) {
      await db.update(skillVersions).set({ status: 'retired' }).where(and(eq(skillVersions.skillId, skill.id), eq(skillVersions.status, 'active')))
    }
    await db.insert(skillVersions).values({
      skillId: skill.id, version, content, status: activate ? 'active' : 'draft', createdBy: 'seed',
      notes: slug === 'domain-halacha_minhag' ? 'Requires owner + rabbi approval before launch' : null,
      activatedAt: activate ? new Date() : null,
    })
    console.log(`+ ${slug} v${version} ${activate ? 'ACTIVE' : 'draft'}`)
  }
  clearSkillCache()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })

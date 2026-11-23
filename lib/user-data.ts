// User profile, projects, and memory. Every function takes the authenticated userId and scopes queries to it.
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { memories, projectFiles, projects, studySessions, userProfiles } from '@/lib/db/schema'
import { checkLimit } from '@/lib/limits'

// sephardi = Sephardi / Edot HaMizrach; chassidic_sefard = Ashkenazi Chassidim praying Nusach Sefard (not Sephardi!)
export const NUSACH_VALUES = ['ashkenazi', 'sephardi', 'chassidic_sefard', 'chabad', 'teimani', 'other'] as const
export const LEVEL_VALUES = ['beginner', 'intermediate', 'advanced'] as const
export const LANGUAGE_VALUES = ['en', 'he', 'fr', 'es', 'ru', 'yi', 'pt', 'de'] as const

export class LimitError extends Error {
  constructor(public key: string, public limit: number) {
    super(`Limit reached: ${key} (${limit})`)
  }
}

// --- Profile ---

export async function getProfile(userId: string) {
  const [p] = await getDb().select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1)
  return p ?? null
}

export interface ProfilePatch {
  uiLanguage?: string | null
  answerLanguage?: string | null
  nusach?: string | null
  level?: string | null
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  const clean: ProfilePatch = {}
  const pick = <T extends readonly string[]>(v: unknown, allowed: T) =>
    v === null ? null : typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v : undefined
  if ('uiLanguage' in patch) clean.uiLanguage = pick(patch.uiLanguage, LANGUAGE_VALUES)
  if ('answerLanguage' in patch) clean.answerLanguage = pick(patch.answerLanguage, LANGUAGE_VALUES)
  if ('nusach' in patch) clean.nusach = pick(patch.nusach, NUSACH_VALUES)
  if ('level' in patch) clean.level = pick(patch.level, LEVEL_VALUES)
  for (const k of Object.keys(clean) as (keyof ProfilePatch)[]) if (clean[k] === undefined) delete clean[k]
  const [row] = await getDb().insert(userProfiles)
    .values({ userId, ...clean })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { ...clean, updatedAt: new Date() } })
    .returning()
  return row
}

// --- Projects ---

export async function listProjects(userId: string) {
  return getDb().select({
    id: projects.id, title: projects.title, description: projects.description,
    createdAt: projects.createdAt, updatedAt: projects.updatedAt,
    sessionCount: sql<number>`(select count(*)::int from ${studySessions} where ${studySessions.projectId} = ${projects.id})`,
    fileCount: sql<number>`(select count(*)::int from ${projectFiles} where ${projectFiles.projectId} = ${projects.id})`,
  }).from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt))
}

export async function createProject(userId: string, plan: string | null | undefined, title: string, description?: string | null) {
  const db = getDb()
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
  const lim = checkLimit(plan, 'maxProjects', n + 1)
  if (!lim.allowed) throw new LimitError('maxProjects', lim.limit!)
  const [row] = await db.insert(projects).values({ userId, title: title.slice(0, 200), description: description?.slice(0, 2000) ?? null }).returning()
  return row
}

export async function getProject(userId: string, projectId: string) {
  const [p] = await getDb().select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.archivedAt))).limit(1)
  return p ?? null
}

export async function getProjectDetail(userId: string, projectId: string) {
  const project = await getProject(userId, projectId)
  if (!project) return null
  const db = getDb()
  const [sessions, mems, files] = await Promise.all([
    db.select({ id: studySessions.id, title: studySessions.title, updatedAt: studySessions.updatedAt })
      .from(studySessions).where(and(eq(studySessions.projectId, projectId), eq(studySessions.userId, userId)))
      .orderBy(desc(studySessions.updatedAt)),
    listMemories(userId, projectId),
    db.select({ id: projectFiles.id, filename: projectFiles.filename, mime: projectFiles.mime, sizeBytes: projectFiles.sizeBytes, status: projectFiles.status, createdAt: projectFiles.createdAt })
      .from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt)),
  ])
  return { project, sessions, memories: mems, files }
}

export async function updateProject(userId: string, projectId: string, patch: { title?: string; description?: string | null }) {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof patch.title === 'string' && patch.title.trim()) set.title = patch.title.trim().slice(0, 200)
  if (patch.description !== undefined) set.description = patch.description?.slice(0, 2000) ?? null
  const [row] = await getDb().update(projects).set(set)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).returning()
  return row ?? null
}

export async function archiveProject(userId: string, projectId: string) {
  await getDb().update(projects).set({ archivedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
}

export async function touchProject(projectId: string) {
  await getDb().update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId))
}

// --- Memory ---

/** projectId null = user-level memories only. */
export async function listMemories(userId: string, projectId: string | null) {
  return getDb().select({ id: memories.id, content: memories.content, kind: memories.kind, projectId: memories.projectId, createdAt: memories.createdAt })
    .from(memories)
    .where(and(
      eq(memories.userId, userId),
      projectId ? eq(memories.projectId, projectId) : isNull(memories.projectId),
      isNull(memories.deletedAt),
    ))
    .orderBy(desc(memories.createdAt))
    .limit(100)
}

export async function addMemory(userId: string, plan: string | null | undefined, content: string, projectId: string | null, kind: 'user' | 'project' | 'pinned') {
  const db = getDb()
  if (projectId) {
    if (!(await getProject(userId, projectId))) throw new Error('Project not found')
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(memories)
      .where(and(eq(memories.projectId, projectId), isNull(memories.deletedAt)))
    const lim = checkLimit(plan, 'maxMemoriesPerProject', n + 1)
    if (!lim.allowed) throw new LimitError('maxMemoriesPerProject', lim.limit!)
  }
  const [row] = await db.insert(memories).values({ userId, projectId, kind, content: content.trim().slice(0, 1000) }).returning()
  return row
}

export async function deleteMemory(userId: string, memoryId: string) {
  await getDb().update(memories).set({ deletedAt: new Date() })
    .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
}

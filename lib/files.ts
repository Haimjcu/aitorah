// Project file uploads: private R2 storage + Anthropic Files API + text extraction (transcription for images/PDFs).
// Files are never given public URLs; downloads go through an authenticated route.
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { and, desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db'
import { projectFiles } from '@/lib/db/schema'
import { checkLimit, TECHNICAL_LIMITS } from '@/lib/limits'
import { ANSWER_MODEL } from '@/lib/ai/models'
import { getProject, LimitError, touchProject } from '@/lib/user-data'

let _s3: S3Client | null = null
function r2(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    })
  }
  return _s3
}
const BUCKET = () => process.env.R2_BUCKET_NAME!
export const filesConfigured = () => !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_BUCKET_NAME)

export class UploadError extends Error {}

const EXTRACT_PROMPT = `Transcribe this file for a Torah study assistant.
1. First line: "DESCRIPTION:" followed by one sentence describing what the file is (e.g. "A scanned page of Mishnah Berurah, siman 271", "Handwritten notes in Hebrew on Berakhot 2a").
2. Then "TEXT:" followed by an exact transcription of all text, preserving the original language (Hebrew, Aramaic, Yiddish, etc.), including nikkud where clearly visible, in reading order. Mark unreadable words as [?]. If the file is a printed sefer page with commentaries around the main text, transcribe the main text first, then each commentary under its name.
Do not translate or explain.`

async function extractText(client: Anthropic, fileId: string, mime: string, buffer: Buffer): Promise<string> {
  if (mime.startsWith('text/')) return buffer.toString('utf8').slice(0, 200_000)
  const block = mime === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'file' as const, file_id: fileId } }
    : { type: 'image' as const, source: { type: 'file' as const, file_id: fileId } }
  const res = await client.messages.stream({
    model: ANSWER_MODEL.model,
    max_tokens: 32000,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: [block, { type: 'text', text: EXTRACT_PROMPT }] }],
  }).finalMessage()
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').slice(0, 200_000)
}

export async function uploadProjectFile(
  client: Anthropic, userId: string, plan: string | null | undefined, projectId: string, file: File,
) {
  if (!(await getProject(userId, projectId))) throw new UploadError('Project not found')
  const mime = file.type || 'application/octet-stream'
  if (!(TECHNICAL_LIMITS.allowedMimeTypes as readonly string[]).includes(mime)) throw new UploadError(`File type not supported: ${mime}`)
  if (file.size > TECHNICAL_LIMITS.maxFileSizeBytes) throw new UploadError('File is larger than 30 MB')
  const sizeCheck = checkLimit(plan, 'maxFileSizeBytes', file.size)
  if (!sizeCheck.allowed) throw new LimitError('maxFileSizeBytes', sizeCheck.limit!)
  const db = getDb()
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(projectFiles).where(eq(projectFiles.projectId, projectId))
  const countCheck = checkLimit(plan, 'maxFilesPerProject', n + 1)
  if (!countCheck.allowed) throw new LimitError('maxFilesPerProject', countCheck.limit!)

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120) || 'file'
  const key = `user-files/${userId}/${projectId}/${randomUUID()}-${safeName}`
  await r2().send(new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: buffer, ContentType: mime }))

  const [row] = await db.insert(projectFiles).values({
    projectId, userId, filename: file.name.slice(0, 200), mime, sizeBytes: file.size, r2Key: key, status: 'processing',
  }).returning()

  try {
    const uploaded = await client.files.upload({ file: await toFile(buffer, safeName, { type: mime }) })
    const extractedText = await extractText(client, uploaded.id, mime, buffer)
    const [done] = await db.update(projectFiles)
      .set({ anthropicFileId: uploaded.id, extractedText, status: 'ready' })
      .where(eq(projectFiles.id, row.id)).returning()
    touchProject(projectId).catch(() => {})
    return done
  } catch (e) {
    console.error('file processing failed:', e)
    await db.update(projectFiles).set({ status: 'failed' }).where(eq(projectFiles.id, row.id))
    throw new UploadError('The file was saved but could not be processed. Try again or upload a clearer copy.')
  }
}

export async function listProjectFiles(projectId: string) {
  return getDb().select({
    id: projectFiles.id, filename: projectFiles.filename, mime: projectFiles.mime, status: projectFiles.status,
    anthropicFileId: projectFiles.anthropicFileId,
    description: sql<string | null>`substring(${projectFiles.extractedText} from 'DESCRIPTION:\\s*([^\\n]{0,200})')`,
  }).from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(desc(projectFiles.createdAt))
}

export async function getProjectFile(userId: string, projectId: string, fileId: string) {
  const [f] = await getDb().select().from(projectFiles)
    .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId), eq(projectFiles.userId, userId))).limit(1)
  return f ?? null
}

export async function downloadFromR2(key: string) {
  const out = await r2().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }))
  return out.Body
}

export async function deleteProjectFile(client: Anthropic, userId: string, projectId: string, fileId: string) {
  const f = await getProjectFile(userId, projectId, fileId)
  if (!f) return false
  await r2().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: f.r2Key })).catch((e) => console.error('r2 delete failed', e))
  if (f.anthropicFileId) await client.files.delete(f.anthropicFileId).catch(() => {})
  await getDb().delete(projectFiles).where(eq(projectFiles.id, f.id))
  return true
}

// POST multipart/form-data {file}: upload a file or image to a project. GET: list files.
import Anthropic from '@anthropic-ai/sdk'
import { requireUser } from '@/lib/api-auth'
import { filesConfigured, listProjectFiles, uploadProjectFile, UploadError } from '@/lib/files'
import { getProfile, getProject, LimitError } from '@/lib/user-data'

export const maxDuration = 300
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  const { id } = await params
  if (!(await getProject(u.userId, id))) return Response.json({ error: 'Not found' }, { status: 404 })
  const files = await listProjectFiles(id)
  return Response.json(files.map(({ anthropicFileId: _a, ...f }) => f))
}

export async function POST(req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  if (!filesConfigured()) return Response.json({ error: 'File storage not configured' }, { status: 503 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'file required' }, { status: 400 })
  try {
    const profile = await getProfile(u.userId)
    const row = await uploadProjectFile(client, u.userId, profile?.plan, (await params).id, file)
    return Response.json({ id: row.id, filename: row.filename, mime: row.mime, sizeBytes: row.sizeBytes, status: row.status }, { status: 201 })
  } catch (e) {
    if (e instanceof LimitError) return Response.json({ error: 'File limit reached', limit: e.limit }, { status: 403 })
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 })
    console.error('upload error:', e)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// GET: download (owner only). DELETE: remove from R2, Anthropic Files API, and the DB.
import Anthropic from '@anthropic-ai/sdk'
import { requireUser } from '@/lib/api-auth'
import { deleteProjectFile, downloadFromR2, getProjectFile } from '@/lib/files'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
type Ctx = { params: Promise<{ id: string; fileId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  const { id, fileId } = await params
  const f = await getProjectFile(u.userId, id, fileId)
  if (!f) return Response.json({ error: 'Not found' }, { status: 404 })
  const body = await downloadFromR2(f.r2Key)
  if (!body) return Response.json({ error: 'Not found' }, { status: 404 })
  return new Response(body.transformToWebStream(), {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const u = await requireUser(); if ('error' in u) return u.error
  const { id, fileId } = await params
  const ok = await deleteProjectFile(client, u.userId, id, fileId)
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: 'Not found' }, { status: 404 })
}

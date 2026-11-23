// GET: skill + all versions. POST {content, notes}: new draft. PATCH {version, action: 'activate'|'retire'}.
import { isAdmin } from '@/lib/admin'
import { activateVersion, createDraft, getSkill, retireVersion } from '@/lib/agent/skill-admin'

type Ctx = { params: Promise<{ slug: string }> }

async function guard() {
  const { authorized, email } = await isAdmin()
  if (!authorized) return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  if (!process.env.DATABASE_URL) return { error: Response.json({ error: 'Database not configured' }, { status: 503 }) }
  return { email: email! }
}

export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard(); if ('error' in g) return g.error
  const found = await getSkill((await params).slug)
  return found ? Response.json(found) : Response.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(req: Request, { params }: Ctx) {
  const g = await guard(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null)
  const content = typeof body?.content === 'string' ? body.content : ''
  if (content.trim().length < 20) return Response.json({ error: 'Content too short' }, { status: 400 })
  try {
    const row = await createDraft((await params).slug, content, g.email, typeof body?.notes === 'string' ? body.notes : null)
    return Response.json(row, { status: 201 })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard(); if ('error' in g) return g.error
  const body = await req.json().catch(() => null)
  const version = Number(body?.version)
  const slug = (await params).slug
  try {
    if (body?.action === 'activate') await activateVersion(slug, version, g.email)
    else if (body?.action === 'retire') await retireVersion(slug, version)
    else return Response.json({ error: 'Unknown action' }, { status: 400 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}

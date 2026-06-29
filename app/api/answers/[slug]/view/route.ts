import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { qaPairs } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true })
  }

  try {
    const db = getDb()
    await db.update(qaPairs)
      .set({ viewCount: sql`${qaPairs.viewCount} + 1` })
      .where(and(eq(qaPairs.slug, slug), eq(qaPairs.status, 'approved')))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

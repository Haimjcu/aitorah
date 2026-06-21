import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const { name, email, password } = await req.json()

    if (!email || !password || password.length < 8) {
      return Response.json({ error: 'Email and password (8+ characters) required' }, { status: 400 })
    }

    const db = getDb()
    const existing = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, email)).limit(1)

    if (existing.length > 0) {
      return Response.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [newUser] = await db.insert(users).values({
      name: name || null,
      email,
      passwordHash,
    }).returning({ id: users.id, email: users.email })

    return Response.json({ id: newUser.id, email: newUser.email }, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

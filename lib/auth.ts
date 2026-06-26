import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb } from './db'
import { users } from './db/schema'

const hasDb = !!process.env.DATABASE_URL

const providers: NextAuthConfig['providers'] = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      if (!hasDb) return null
      const db = getDb()
      const [user] = await db.select().from(users)
        .where(eq(users.email, credentials.email as string)).limit(1)
      if (!user || !user.passwordHash) return null
      const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
      if (!valid) return null
      return { id: user.id, name: user.name, email: user.email, image: user.image }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers,
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
      }
      if (profile) {
        token.name = profile.name
        token.email = profile.email
        token.picture = profile.picture
      }
      if (account?.provider === 'google' && profile?.email && hasDb) {
        try {
          const db = getDb()
          const [existing] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.email, profile.email as string))
            .limit(1)
          if (existing) {
            token.sub = existing.id
          } else {
            const [created] = await db.insert(users).values({
              email: profile.email as string,
              name: (profile.name as string) ?? null,
              image: (profile.picture as string) ?? null,
            }).returning({ id: users.id })
            if (created) token.sub = created.id
          }
        } catch (e) {
          console.error('Failed to link Google user to DB:', e)
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
  },
  pages: {
    signIn: '/study',
  },
})

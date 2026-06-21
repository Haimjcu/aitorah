import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb } from './db'
import { users, accounts, authSessions, verificationTokens } from './db/schema'

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
  adapter: hasDb
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: authSessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  session: { strategy: 'jwt' },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/study',
  },
})

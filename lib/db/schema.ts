import { pgTable, text, timestamp, integer, uuid, index, real, uniqueIndex } from 'drizzle-orm/pg-core'

// --- NextAuth tables ---

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_users_email').on(table.email),
])

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => [
  index('idx_accounts_user').on(table.userId),
])

export const authSessions = pgTable('auth_sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex('idx_vt_token').on(table.token),
])

// --- Study sessions ---

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  messages: text('messages').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_study_sessions_user').on(table.userId),
  index('idx_study_sessions_updated').on(table.updatedAt),
])

// --- Q&A cache ---

export const qaPairs = pgTable('qa_pairs', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  questionNormalized: text('question_normalized').notNull(),
  answerMarkdown: text('answer_markdown').notNull(),
  sourceRefs: text('source_refs').array().notNull(),
  topics: text('topics').array(),
  categories: text('categories').array(),
  language: text('language').default('en'),
  viewCount: integer('view_count').default(0),
  slug: text('slug').unique(),
  similarity: real('similarity'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_qa_slug').on(table.slug),
  index('idx_qa_created').on(table.createdAt),
])

// Legacy TypeScript interfaces (pre-Drizzle) — kept for backward compatibility

export type UserRole = 'member' | 'creator' | 'admin'
export type ListingStatus = 'draft' | 'active' | 'archived'
export type OrderStatus = 'pending' | 'paid' | 'refunded'
export type TorahSource = 'tanakh' | 'mishnah' | 'gemara' | 'rishon' | 'acharon'

export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  discourse_id: number | null
  stripe_customer_id: string | null
  created_at: Date
}

export interface TorahText {
  id: number
  source: TorahSource
  book: string
  chapter: number | null
  verse: number | null
  text_hebrew: string | null
  text_english: string | null
  reference: string
  created_at: Date
}

export interface StudySession {
  id: string
  user_id: string
  title: string | null
  messages: { role: string; content: string; sources?: unknown[] }[]
  created_at: Date
  updated_at: Date
}

export interface MarketplaceListing {
  id: string
  creator_id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  category: 'app' | 'dataset' | 'course' | 'tool' | null
  stripe_price_id: string | null
  status: ListingStatus
  created_at: Date
}

export interface Order {
  id: string
  buyer_id: string
  listing_id: string
  stripe_session_id: string | null
  amount_cents: number
  status: OrderStatus
  created_at: Date
}

export interface RlhfFeedback {
  id: string
  user_id: string
  session_id: string
  message_idx: number
  rating: number
  correction: string | null
  created_at: Date
}

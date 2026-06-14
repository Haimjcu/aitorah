import { pgTable, text, timestamp, integer, uuid, index, real } from 'drizzle-orm/pg-core'

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

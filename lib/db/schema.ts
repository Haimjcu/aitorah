import { pgTable, text, timestamp, integer, uuid, index, real, uniqueIndex, jsonb, boolean, bigint } from 'drizzle-orm/pg-core'

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
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_study_sessions_user').on(table.userId),
  index('idx_study_sessions_updated').on(table.updatedAt),
  index('idx_study_sessions_project').on(table.projectId),
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
  status: text('status').default('pending').notNull(),
  canonicalId: uuid('canonical_id'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  featuredImageUrl: text('featured_image_url'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  aiScore: integer('ai_score'),
  aiScoreReasons: jsonb('ai_score_reasons'),
}, (table) => [
  index('idx_qa_slug').on(table.slug),
  index('idx_qa_created').on(table.createdAt),
  index('idx_qa_status').on(table.status),
  index('idx_qa_published').on(table.publishedAt),
])

// =====================================================================
// Agent platform tables (docs/12-agent-platform-build-plan.md §3)
// =====================================================================

// --- User profile & projects ---

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  uiLanguage: text('ui_language'),            // en | he | fr | es | ru | yi | pt | de
  answerLanguage: text('answer_language'),    // null = answer in the language the user writes in
  nusach: text('nusach'),                     // ashkenaz | sefard | edot_hamizrach | chabad | other | null (not set)
  level: text('level'),                       // beginner | intermediate | advanced | null
  plan: text('plan').default('free').notNull(), // key into lib/limits.ts
  trustedReviewer: boolean('trusted_reviewer').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_projects_user').on(table.userId),
])

export const projectFiles = pgTable('project_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  r2Key: text('r2_key').notNull(),
  anthropicFileId: text('anthropic_file_id'),
  extractedText: text('extracted_text'),
  status: text('status').default('uploaded').notNull(), // uploaded | processing | ready | failed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_project_files_project').on(table.projectId),
])

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = user-level memory
  kind: text('kind').notNull(),               // user | project | pinned
  content: text('content').notNull(),
  sourceMessageId: uuid('source_message_id'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_memories_user').on(table.userId),
  index('idx_memories_project').on(table.projectId),
])

// --- Normalized chat messages (new chats; old sessions keep the JSON blob until backfilled) ---

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => studySessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),               // user | assistant
  content: text('content').notNull(),
  sources: jsonb('sources'),
  domain: text('domain'),
  language: text('language'),
  model: text('model'),
  skillVersions: jsonb('skill_versions'),     // { [skillSlug]: version }
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_chat_messages_session').on(table.sessionId, table.createdAt),
])

// --- Skills (versioned, editable without deploy) ---

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  kind: text('kind').notNull(),               // domain | shared | base_prompt
  domain: text('domain'),                     // tanakh_parasha | halacha_minhag | gemara_mishnah | kabbalah_chassidut | machshava_mussar_life | null
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_skills_slug').on(table.slug),
])

export const skillVersions = pgTable('skill_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),         // markdown instructions
  toolAllowlist: text('tool_allowlist').array(),
  status: text('status').default('draft').notNull(), // draft | active | retired
  createdBy: text('created_by'),              // user email, 'learning-loop', or 'seed'
  notes: text('notes'),
  evalRunId: uuid('eval_run_id'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_skill_versions_skill_version').on(table.skillId, table.version),
  index('idx_skill_versions_status').on(table.skillId, table.status),
])

// --- Corrections & learning loop ---

export const corrections = pgTable('corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => chatMessages.id, { onDelete: 'set null' }),
  qaPairId: uuid('qa_pair_id').references(() => qaPairs.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  category: text('category'),                 // wrong_fact | wrong_source | missing_view | translation | formatting | tone | other
  riskTier: text('risk_tier'),                // low | high | halachic (set by classifier)
  status: text('status').default('new').notNull(), // new | triaged | reviewer_approved | proposed | applied | rejected
  reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  proposalId: uuid('proposal_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, (table) => [
  index('idx_corrections_status').on(table.status),
])

export const changeProposals = pgTable('change_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  fromVersionId: uuid('from_version_id').references(() => skillVersions.id, { onDelete: 'set null' }),
  proposedContent: text('proposed_content').notNull(),
  rationale: text('rationale'),
  riskTier: text('risk_tier').notNull(),      // low | high | halachic
  sourceCorrectionIds: uuid('source_correction_ids').array(),
  evalRunId: uuid('eval_run_id'),
  status: text('status').default('pending').notNull(), // pending | evals_failed | awaiting_approval | applied | rejected
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_change_proposals_status').on(table.status),
])

// --- Evals ---

export const evalCases = pgTable('eval_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),                 // stable id from evals/cases.jsonl, e.g. halacha_minhag-001
  domain: text('domain').notNull(),
  language: text('language').notNull(),
  question: text('question').notNull(),
  context: jsonb('context'),                  // optional prior turns
  expected: text('expected'),                 // reference answer / key points (reviewed for halacha)
  rubric: jsonb('rubric'),                    // domain-specific grading criteria
  mustCite: text('must_cite').array(),        // refs that a good answer should cite
  source: text('source').notNull(),           // corpus | owner | correction
  status: text('status').default('draft').notNull(), // draft | approved | retired
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_eval_cases_key').on(table.key),
  index('idx_eval_cases_domain').on(table.domain, table.status),
])

export const evalRuns = pgTable('eval_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  target: text('target').notNull(),           // legacy | agent
  config: jsonb('config'),                    // models, effort, skill versions, filters
  summary: jsonb('summary'),                  // per-domain / per-language scores
  costUsd: real('cost_usd'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const evalResults = pgTable('eval_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => evalRuns.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').notNull().references(() => evalCases.id, { onDelete: 'cascade' }),
  answer: text('answer'),
  scores: jsonb('scores'),
  passed: boolean('passed'),
  costUsd: real('cost_usd'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_eval_results_run').on(table.runId),
])

// --- Observability: one row per generated answer (legacy and agent) ---

export const answerLogs = pgTable('answer_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipeline: text('pipeline').notNull(),       // legacy | agent | eval
  intent: text('intent'),                     // legacy intent type or agent domain
  language: text('language'),
  models: text('models').array(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  cacheReadTokens: integer('cache_read_tokens').default(0).notNull(),
  cacheWriteTokens: integer('cache_write_tokens').default(0).notNull(),
  costUsd: real('cost_usd'),
  latencyMs: integer('latency_ms'),
  ttftMs: integer('ttft_ms'),
  stopReason: text('stop_reason'),
  toolCalls: jsonb('tool_calls'),
  cacheHit: boolean('cache_hit').default(false).notNull(), // served from qa_pairs cache
  turn: integer('turn'),                      // number of user turns in the conversation
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_answer_logs_created').on(table.createdAt),
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

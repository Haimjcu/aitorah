# Backend Architecture — AI Torah

## 1. Architecture Overview

The backend is embedded inside the Next.js application as Route Handlers under `app/api/`. There is no separate Node/Express server. All backend logic runs inside the same Railway service (`aitorah-web`), keeping deployment simple and eliminating inter-service network hops for the hot paths.

```
Browser → Next.js API Routes → PostgreSQL (via Drizzle ORM)
                             → pgvector (semantic search)
                             → Redis (cache / rate limit)
                             → Anthropic/OpenAI (LLM calls)
                             → Stripe (payments)
                             → Discourse API (community sync)
```

---

## 2. Database Schema

### ORM: Drizzle ORM
- Type-safe, lightweight, generates clean SQL
- Migrations managed via `drizzle-kit`
- Schema defined in `lib/db/schema.ts`

### Core Tables

#### `users`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
email        TEXT UNIQUE NOT NULL
name         TEXT
image        TEXT
role         TEXT DEFAULT 'member'  -- member | creator | admin
discourse_id INT
stripe_customer_id TEXT
created_at   TIMESTAMPTZ DEFAULT now()
```

#### `sessions` (NextAuth adapter table)
Managed by NextAuth Drizzle adapter — not manually defined.

#### `torah_texts`
```sql
id           BIGSERIAL PRIMARY KEY
source       TEXT NOT NULL  -- 'tanakh' | 'mishnah' | 'gemara' | 'rishon' | 'acharon'
book         TEXT NOT NULL
chapter      INT
verse        INT
text_hebrew  TEXT
text_english TEXT
reference    TEXT NOT NULL  -- e.g. "Berakhot 2a"
embedding    VECTOR(1536)   -- OpenAI text-embedding-3-small
created_at   TIMESTAMPTZ DEFAULT now()
```
Index: `CREATE INDEX ON torah_texts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`

#### `study_sessions`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id      UUID REFERENCES users(id) ON DELETE CASCADE
title        TEXT
messages     JSONB NOT NULL DEFAULT '[]'  -- {role, content, sources}[]
created_at   TIMESTAMPTZ DEFAULT now()
updated_at   TIMESTAMPTZ DEFAULT now()
```

#### `marketplace_listings`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
creator_id   UUID REFERENCES users(id)
title        TEXT NOT NULL
description  TEXT
price_cents  INT NOT NULL
currency     TEXT DEFAULT 'usd'
category     TEXT  -- 'app' | 'dataset' | 'course' | 'tool'
stripe_price_id TEXT
status       TEXT DEFAULT 'draft'  -- draft | active | archived
created_at   TIMESTAMPTZ DEFAULT now()
```

#### `orders`
```sql
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
buyer_id             UUID REFERENCES users(id)
listing_id           UUID REFERENCES marketplace_listings(id)
stripe_session_id    TEXT UNIQUE
amount_cents         INT
status               TEXT DEFAULT 'pending'  -- pending | paid | refunded
created_at           TIMESTAMPTZ DEFAULT now()
```

#### `rlhf_feedback`
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id      UUID REFERENCES users(id)
session_id   UUID REFERENCES study_sessions(id)
message_idx  INT
rating       SMALLINT CHECK (rating BETWEEN 1 AND 5)
correction   TEXT
created_at   TIMESTAMPTZ DEFAULT now()
```

---

## 3. API Routes

### Authentication

#### `POST /api/auth/[...nextauth]`
NextAuth.js handler. Supports:
- Email/password (credentials provider with bcrypt)
- Google OAuth
- Discord OAuth

On sign-in, also syncs user to Discourse via SSO.

#### `GET /api/discourse/sso`
Discourse SSO endpoint. Validates nonce, signs user payload with `DISCOURSE_SSO_SECRET`, redirects back to Discourse.

---

### AI — Study Partner

#### `POST /api/chat`
Streaming endpoint using Vercel AI SDK.

**Request body:**
```json
{
  "messages": [{"role": "user", "content": "What does the Talmud say about honesty in business?"}],
  "sessionId": "uuid-optional"
}
```

**Logic:**
1. Authenticate user (session check)
2. Rate limit: 20 requests/minute via Redis
3. Extract last user message
4. Vector search `torah_texts` for top-10 relevant passages (cosine similarity)
5. Build Claude system prompt with retrieved passages (RAG context)
6. Stream response via `anthropic.messages.stream`
7. On completion: save message + sources to `study_sessions`
8. Return `StreamingTextResponse`

**System prompt template** (`lib/ai/prompts.ts`):
```
You are a learned Torah study partner with deep knowledge of Tanakh, Talmud, and Halacha.
You answer questions based on traditional Jewish sources.
Always cite your sources in the format: [Source Name, Reference].
Below are relevant source passages retrieved for this question:

{passages}

Answer the user's question based on these sources and your knowledge.
```

---

### Search

#### `GET /api/search?q={query}&limit={20}&source={filter}`
Semantic search over Torah texts.

**Logic:**
1. Generate embedding for `q` using OpenAI `text-embedding-3-small`
2. Cache embedding in Redis (TTL 1 hour) — same query = same embedding
3. Run pgvector cosine similarity query:
   ```sql
   SELECT id, reference, text_hebrew, text_english, source,
          1 - (embedding <=> $1) AS similarity
   FROM torah_texts
   WHERE ($2::text IS NULL OR source = $2)
   ORDER BY embedding <=> $1
   LIMIT $3;
   ```
4. Return ranked results with similarity scores

---

### Marketplace

#### `GET /api/marketplace/listings`
Returns paginated active listings. Supports `?category=`, `?sort=recent|popular`.

#### `POST /api/marketplace/listings`
Create a new listing. Requires `creator` or `admin` role. Creates Stripe Product + Price.

#### `POST /api/checkout`
Creates a Stripe Checkout Session for a listing purchase.

**Request body:**
```json
{ "listingId": "uuid" }
```

Returns `{ url: "https://checkout.stripe.com/..." }`.

#### `POST /api/webhooks/stripe`
Handles Stripe events:
- `checkout.session.completed` → write order, grant access
- `payment_intent.payment_failed` → update order status

Verified with `stripe.webhooks.constructEvent` using `STRIPE_WEBHOOK_SECRET`.

---

### Content Revalidation

#### `POST /api/webhooks/sanity`
Triggered by Sanity on content publish/update. Calls `revalidatePath` for affected routes.

**Sanity webhook config:** Send `documentType` and `slug` in body, verify with `SANITY_WEBHOOK_SECRET`.

---

### RLHF

#### `POST /api/feedback`
Save user rating/correction on a study partner response.

**Request body:**
```json
{
  "sessionId": "uuid",
  "messageIdx": 3,
  "rating": 4,
  "correction": "optional corrected answer text"
}
```

---

## 4. Authentication Flow (Detail)

```
1. User submits credentials or clicks OAuth
2. NextAuth validates → creates JWT
   JWT payload: { sub: userId, email, role, discourseId }
3. JWT stored in httpOnly cookie (aitorah-session)
4. On Discourse visit:
   a. User hits /community → middleware detects no Discourse cookie
   b. Redirect to /api/discourse/sso?sso=...&sig=...
   c. Route validates NextAuth session
   d. Builds SSO payload: nonce, email, username, external_id
   e. Signs with HMAC-SHA256 using DISCOURSE_SSO_SECRET
   f. Redirects to https://community.aitorah.ai/session/sso_login
5. Discourse creates/updates user, sets its own session cookie
```

---

## 5. Middleware

`middleware.ts` runs on the Edge runtime before every request.

Responsibilities:
1. **Route protection:** Redirect unauthenticated users to `/signin` for all `(app)` routes
2. **Role gating:** Return 403 for `creator`-only routes if user role is `member`
3. **Security headers:** Add `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`
4. **Rate limiting:** Check Redis token bucket on `/api/chat` and `/api/search`

```typescript
// middleware.ts — matcher config
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/study/:path*',
    '/search',
    '/marketplace/sell/:path*',
    '/settings/:path*',
    '/api/chat',
    '/api/search',
    '/api/checkout',
    '/api/feedback',
  ],
}
```

---

## 6. Torah Text Ingestion Pipeline

A one-time (and periodic) data pipeline to populate `torah_texts` with embeddings.

```
Source: Sefaria API (https://www.sefaria.org/api/)
Script: scripts/ingest-torah.ts

For each text chunk:
1. Fetch from Sefaria API by book + chapter
2. Split into passage-level chunks (verse for Tanakh, mishnah for Mishnah, amud for Gemara)
3. Call OpenAI text-embedding-3-small on English text
4. Batch insert into torah_texts with embedding
5. Log progress to console

Rate limiting: 100ms delay between Sefaria API calls
Batch size: 100 rows per INSERT for pgvector performance
```

Run once during Railway deployment with: `npx tsx scripts/ingest-torah.ts`

---

## 7. Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Railway PostgreSQL connection string |
| `REDIS_URL` | Railway Redis connection string |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | Full URL of the app (e.g. https://aitorah.ai) |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `DISCORD_CLIENT_ID` | Discord OAuth |
| `DISCORD_CLIENT_SECRET` | Discord OAuth |
| `ANTHROPIC_API_KEY` | Claude API |
| `OPENAI_API_KEY` | Embeddings |
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `DISCOURSE_SSO_SECRET` | Discourse SSO signing |
| `DISCOURSE_API_KEY` | Discourse REST API |
| `DISCOURSE_URL` | Discourse base URL |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project |
| `NEXT_PUBLIC_SANITY_DATASET` | Sanity dataset (production) |
| `SANITY_API_TOKEN` | Sanity write token (server-only) |
| `SANITY_WEBHOOK_SECRET` | Sanity webhook verification |

---

## 8. Error Handling

All API route handlers follow this pattern:
```typescript
export async function POST(req: Request) {
  try {
    // validate input with Zod
    // check auth
    // business logic
    return Response.json({ data })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.flatten() }, { status: 400 })
    if (error instanceof AuthError) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

LLM errors (rate limit, context overflow) are caught and return a user-friendly streaming error message rather than a hard HTTP error.

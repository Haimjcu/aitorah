# AI Torah — Architecture Document

> Last updated: 2026-06-29

---

## 1. Project Purpose

AI Torah is a web platform at the intersection of artificial intelligence and Torah scholarship. It provides an **AI-powered study partner** (conversational Q&A with cited sources), **semantic Torah search** across the Sefaria library, and a **community hub** for scholars and developers to collaborate.

The target audience is Torah scholars, developers building Torah AI tools, and educators. The project is founded by Rabbi Haim Lubin and is in its early/MVP stage — the website and core AI chat are functional with authentication and session persistence, while several planned features (marketplace, forums, CMS content) exist only as scaffolded placeholders.

---

## 2. Functionality

### 2.1 High-Level Overview

- **AI Study Partner** — Conversational Torah study powered by Claude (Anthropic). Users ask questions; the system retrieves relevant sources from Sefaria, then streams an AI-generated answer with citations. Sessions are persisted to PostgreSQL for authenticated users.
- **Authentication** — Email+password and Google OAuth sign-in via NextAuth v5 (Auth.js). Pure JWT session strategy (no database adapter for OAuth). Google OAuth users are linked to database users by email lookup in the JWT callback, ensuring the same user identity across sign-in methods. Credentials provider queries PostgreSQL directly for email/password login. Anonymous users can try one chat exchange before being prompted to sign in.
- **Session Persistence** — Authenticated users' chat sessions are saved to PostgreSQL with auto-save on each response. Sessions appear in a left sidebar (Claude Desktop-style) with load, delete, and new session controls.
- **Jewish Calendar (Hebcal)** — Real-time calendar data via Hebcal REST APIs: weekly parasha with full leyning, daily learning schedules (Daf Yomi, Mishna Yomi, etc.), Shabbat/candle-lighting times, halachic zmanim, upcoming holidays, and Hebrew↔Gregorian date conversion. IP-based geolocation detects Israel vs. Diaspora for parasha/schedule differences.
- **Torah Search** — Full-text search across the Sefaria library (Tanakh, Mishnah, Gemara, Rishonim, Acharonim) via Sefaria's ElasticSearch API. Supports category filtering.
- **Q&A Cache** — Previously answered questions are cached in PostgreSQL. Identical questions return cached answers instantly.
- **Public Q&A Pages** — Approved Q&A pairs are published as SEO-optimized pages at `/answers/[slug]` with Schema.org QAPage structured data, ISR (1hr), and OG metadata. Browse page at `/answers` with sort controls (newest/most viewed), 30 items per page, and topics sidebar. All Q&A pages (`/answers`, `/answers/[slug]`, `/topics/[slug]`) share a `QaPageLayout` with a topics sidebar (desktop: 220px vertical nav; mobile: 2-column grid above content).
- **Topic Pages** — Browse Q&A by Sefaria's 17 categories at `/topics` (index) and `/topics/[slug]` (per-category with sort controls). Schema.org CollectionPage markup, ISR (30min).
- **Admin Review Queue** — Admin-only UI at `/admin` for curating Q&A pairs before publication. AI scoring (100-point scale), rendered markdown preview, edit/save/approve/reject workflow, DALL-E image generation with preview.
- **AI Image Generation** — On-demand DALL-E (gpt-image-1) featured images generated from the question + answer summary. Images are compressed via Sharp (1200×800 WebP) and stored in Cloudflare R2.
- **Contact Form** — Collects name, email, phone, interests, and message. Sends notification email via Resend.
- **Feedback Collection** — Accepts RLHF-style feedback (rating + correction) per chat message. Currently logs to console only (DB write is a TODO).
- **Community Page** — Static page directing users to the Discord server.
- **Health Check** — Simple `/api/health` endpoint for deployment monitoring.
- **SEO** — Auto-generated `robots.txt`, `sitemap.xml` (includes all published Q&A and topic pages), dynamic `llms.txt` route (ISR 1hr, lists all published Q&A), OpenGraph images (with `fb:app_id` for Facebook), Apple icon, PWA manifest, JSON-LD structured data (QAPage, CollectionPage, BreadcrumbList, Organization, WebSite), per-page metadata.
- **PWA** — Installable Progressive Web App via `@ducanh2912/next-pwa`. Service worker caches `/study` and `/search` pages (NetworkFirst), API responses (NetworkFirst with 10s timeout), and static assets (CacheFirst). Custom install banner appears after 60s on study/search pages; permanent install button in footer on mobile. Opens to `/study` in standalone mode.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser / User                         │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│   │  Home    │  │  Study   │  │  Search   │  │  Community / │  │
│   │  Page    │  │  Partner │  │  Page     │  │  Contact     │  │
│   └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  │
│        │             │              │                │           │
└────────┼─────────────┼──────────────┼────────────────┼───────────┘
         │             │              │                │
         │   ┌─────────▼──────────┐   │    ┌───────────▼──────────┐
         │   │  POST /api/chat    │   │    │  POST /api/contact   │
         │   │  (streaming)       │   │    │  (Resend email)      │
         │   └─────────┬──────────┘   │    └──────────────────────┘
         │             │              │
         │   ┌─────────▼──────────┐   │
         │   │  RAG Pipeline      │   │
         │   │  1. Intent classify│   │
         │   │     (Haiku)        │   │
         │   │  2a. Hebcal API    │   │
         │   │     (if calendar)  │   │
         │   │  2b. Sefaria API   │   │
         │   │     retrieval      │   │
         │   │  3. Claude answer  │   │
         │   │     (Sonnet)       │   │
         │   └─────────┬──────────┘   │
         │             │              │
    ┌────┼─────────────┼──────────────┼───────────────────────┐
    │    │       External Services    │                       │
    │    │             │              │                       │
    │  ┌─▼───────┐ ┌──▼───────┐ ┌───▼──────┐ ┌───────────┐  │
    │  │Sefaria  │ │Anthropic │ │Sefaria   │ │ Resend    │  │
    │  │API      │ │Claude API│ │Search API│ │ Email API │  │
    │  └─────────┘ └──────────┘ └──────────┘ └───────────┘  │
    │                                                        │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
    │  │Hebcal   │  │ip-api.com│  │PostgreSQL│             │
    │  │REST APIs│  │(geo-     │  │(Q&A     │             │
    │  │(calendar│  │ locate)  │  │ cache)  │             │
    │  │ data)   │  └──────────┘  └─────────┘             │
    │  └─────────┘                                         │
    │                ┌──────────┐  ┌──────────┐               │
    │                │ Redis    │  │ OpenAI   │               │
    │                │(ioredis) │  │ DALL-E   │               │
    │                │(rate     │  │(image    │               │
    │                │ limit +  │  │ gen)     │               │
    │                │ cache)   │  └──────────┘               │
    │                └──────────┘                             │
    │                ┌──────────┐                             │
    │                │Cloudflare│                             │
    │                │ R2       │                             │
    │                │(image    │                             │
    │                │ storage) │                             │
    │                └──────────┘                             │
    └────────────────────────────────────────────────────────┘
```

### 2.2 Feature Deep-Dives

#### 2.2.1 AI Study Partner (Chat)

**Purpose**: The primary feature. Allows users to ask Torah questions and receive cited, sourced answers in a conversational chat interface.

**How it works**:
1. User types a question in the chat UI (`components/study/ChatInterface.tsx`) or the hero input on the home page (`components/home/HeroChat.tsx`).
2. If from the home page, the user is redirected to `/study?q=<encoded question>`.
3. `ChatInterface` sends `POST /api/chat` with the full message history.
4. **Rate limiting**: `lib/ratelimit.ts` checks per-IP limits via ioredis sliding window (10/min, 50/day). If Redis is not configured, rate limiting is skipped.
5. **Q&A Cache check**: If `DATABASE_URL` is set and this is the first message, `lib/db/qa.ts:findSimilarQuestion()` checks for an exact normalized match. On cache hit, the cached answer is returned immediately (non-streaming) with `X-Cache: HIT` header.
6. **Intent classification** (`lib/rag/intent.ts:classifyIntent()`): Sends the question to Claude Haiku (`claude-haiku-4-5-20251001`) with a structured JSON prompt. Extracts: intent type (including 7 `calendar_*` types), Sefaria references, topic slugs, English/Hebrew search terms, category hint, and optional `calendar_params`.
7. **Calendar resolution** (if `intent.type` starts with `calendar_`):
   - **Geolocation** (`lib/hebcal/geo.ts:resolveGeo()`): If the intent needs location data, resolves the user's IP to coordinates via ip-api.com (cached 24h). Falls back to New York/Diaspora for private IPs or failures.
   - **Hebcal API call** (`lib/hebcal/resolver.ts:resolveCalendar()`): Routes to the appropriate resolver based on intent type:
     - `calendar_parasha` → Shabbat API for parasha name, full leyning (7 aliyot + maftir + haftarah), candle-lighting/havdalah times. Also extracts a `parashaRef` (Torah reading ref) to inject into Sefaria retrieval.
     - `calendar_learning` → Calendar API for Daf Yomi, Mishna Yomi, Yerushalmi, Tanakh Yomi, Rambam, Chofetz Chaim, Tehillim.
     - `calendar_shabbat` → Shabbat API for candle-lighting/havdalah times.
     - `calendar_zmanim` → Zmanim API for all halachic times (alot hashachar through tzeit hakochavim).
     - `calendar_holiday` → Calendar API looking 90 days ahead for upcoming holidays.
     - `calendar_date` → Date converter API for Hebrew↔Gregorian conversion.
     - `calendar_general` → Hebrew date + this week's events.
   - The resolved calendar context is injected into the system prompt as a dedicated `CALENDAR AND SCHEDULE DATA` block.
8. **RAG Retrieval** (`lib/rag/retrieval.ts:retrieve()`): Accepts the pre-classified intent (avoids double-classification). Runs multi-strategy retrieval in parallel via `Promise.allSettled`:
     - `retrieveByRefs()` — Direct Sefaria text lookup for any detected references (including `parashaRef` from calendar resolution)
     - `retrieveByTopics()` — Sefaria topic API for detected topics
     - `retrieveBySearch()` — Full-text search via Sefaria's ElasticSearch (lemmatized + exact)
     - `retrieveCommentary()` — Fetches commentary links for commentary requests
     - `retrieveByAutocomplete()` — Sefaria name/autocomplete API as a fallback
   - Results are deduplicated by `ref`, scored, and the top 8 sources are selected.
9. **Answer generation**: Sources are formatted into a text block (`formatSourcesForPrompt()`), injected into a system prompt (`lib/ai/prompts.ts:buildStudyPartnerSystemPrompt()`) along with optional calendar context, and sent to Claude Sonnet (`claude-sonnet-4-6`) via the Anthropic streaming API.
10. **Streaming**: The response is streamed as a `ReadableStream`. A `<!--SOURCES:...-->` JSON prefix is prepended before the answer text. The client parses this prefix to extract source metadata.
11. **Q&A Caching**: After streaming completes, if the answer is >50 chars and `DATABASE_URL` is set, the Q&A pair is saved to PostgreSQL (`lib/db/qa.ts:saveQaPair()`).

**Files involved**:
- `app/api/chat/route.ts` — API route handler (orchestrates intent → calendar → retrieval → generation)
- `lib/rag/intent.ts` — Intent classification (Haiku) with 7 calendar intent types + `calendar_params`
- `lib/rag/retrieval.ts` — Multi-strategy Sefaria retrieval pipeline
- `lib/hebcal/resolver.ts` — Calendar intent → Hebcal API call routing + response formatting
- `lib/hebcal/client.ts` — Hebcal REST API client (calendar, shabbat, zmanim, date converter) with in-memory LRU cache
- `lib/hebcal/geo.ts` — IP geolocation via ip-api.com (Israel/Diaspora detection, 24h cache)
- `lib/hebcal/types.ts` — TypeScript interfaces for all Hebcal API responses
- `lib/sefaria/client.ts` — Sefaria API client (all HTTP calls)
- `lib/sefaria/types.ts` — TypeScript interfaces for Sefaria responses
- `lib/ai/prompts.ts` — System prompt builder (accepts optional `calendarContext` parameter). Enforces AEO-optimized answer structure: direct 2-3 sentence answer first, then Key Takeaways section, then detailed answer. No summary at bottom.
- `lib/db/qa.ts` — Q&A pair CRUD (save, find similar, get by slug, list recent)
- `lib/db/index.ts` — Drizzle/pg connection pool
- `lib/db/schema.ts` — Drizzle table definitions (qa_pairs, users, accounts, auth_sessions, study_sessions, verification_tokens)
- `lib/auth.ts` — NextAuth v5 configuration (Google + Credentials providers, pure JWT strategy, no database adapter)
- `lib/ratelimit.ts` — ioredis sliding window rate limiting
- `lib/redis.ts` — ioredis singleton client with caching helpers (cacheGet, cacheSet, cacheDel, incrViewCount)
- `components/study/ChatInterface.tsx` — Chat UI with auth-aware session sidebar, combined mobile drawer (sessions + nav), auth prompt
- `components/study/AuthModal.tsx` — Sign in / sign up modal (email+password, Google OAuth)
- `components/providers/AuthProvider.tsx` — NextAuth SessionProvider wrapper
- `components/ui/CopyButton.tsx` — Copy-to-clipboard button with checkmark feedback
- `components/home/HeroChat.tsx` — Home page chat input

**Dependencies**: Anthropic API (Claude Haiku + Sonnet), Sefaria API, Hebcal API (hebcal.com, no auth), ip-api.com (geolocation, no auth), optionally PostgreSQL + Redis (ioredis).

#### 2.2.2 Torah Search

**Purpose**: Full-text search across the Sefaria library with source-type filtering and relevance scoring.

**How it works**:
1. User types a query in the search UI (`components/search/SearchInterface.tsx`).
2. User can select a filter: All Texts, Tanakh, Mishnah, Gemara, Rishonim, Acharonim.
3. `SearchInterface` sends `GET /api/search?q=<query>&source=<filter>&limit=20`.
4. The API route (`app/api/search/route.ts`) calls Sefaria's search API via two strategies in parallel:
   - `searchTexts()` — Lemmatized/morphological search (slop=2)
   - `searchExact()` — Exact match search
5. Results are deduplicated by `ref`, scored using Sefaria's `_score` and boosted for exact matches.
6. Each result includes: ref, categories, relevance score (1-99%), Hebrew text, English text, and Sefaria URL.
7. Results are sorted by relevance and returned to the client.

**Files involved**:
- `app/api/search/route.ts` — API route handler
- `lib/sefaria/client.ts:searchTexts()`, `searchExact()`, `hitToText()` — Sefaria search functions
- `lib/sefaria/types.ts:SefariaSearchHit`, `SefariaSearchResponse` — Type definitions
- `components/search/SearchInterface.tsx` — Search UI component

**Dependencies**: Sefaria API (ElasticSearch endpoint).

#### 2.2.3 Q&A Cache & Answers API

**Purpose**: Stores previously answered Q&A pairs for fast retrieval and potential SEO-friendly answer pages.

**How it works**:
1. After a chat answer is generated, `saveQaPair()` writes it to the `qa_pairs` table.
2. On subsequent identical questions, `findSimilarQuestion()` returns the cached answer.
3. The `/api/answers` endpoint exposes the cache: `GET /api/answers?slug=<slug>` returns a single Q&A pair; `GET /api/answers` returns the 50 most recent.
4. View counts are incremented on each access.

**Files involved**:
- `app/api/answers/route.ts` — Answers API route
- `lib/db/qa.ts` — All Q&A database operations
- `lib/db/schema.ts` — `qa_pairs` table schema
- `drizzle/0000_fuzzy_tombstone.sql` — Database migration

**Dependencies**: PostgreSQL (optional — features degrade gracefully without it).

#### 2.2.4 Contact Form

**Purpose**: Collects interest from potential collaborators, scholars, and developers.

**How it works**:
1. User fills out the form on `/contact` (`app/(marketing)/contact/page.tsx`).
2. Form submits `POST /api/contact` with: name, email, phone (optional), message (optional), interests (array).
3. The API validates input with Zod (`ContactSchema`) and sends an email via Resend to `CONTACT_EMAIL`.

**Files involved**:
- `app/(marketing)/contact/page.tsx` — Contact form UI
- `app/api/contact/route.ts` — API route with Zod validation + Resend
- `lib/ratelimit.ts` — (not currently applied to contact, only chat)

**Dependencies**: Resend API (`RESEND_API_KEY`, `CONTACT_EMAIL`).

#### 2.2.5 Feedback Collection

**Purpose**: Collect RLHF-style feedback on AI-generated answers.

**How it works**:
1. `POST /api/feedback` accepts: sessionId (UUID), messageIdx, rating (1-5), correction (optional).
2. Validated with Zod.
3. Currently **logs to console only** — writing to DB is a TODO (see comment in `app/api/feedback/route.ts:18`).

**Files involved**:
- `app/api/feedback/route.ts` — API route (stub)

**Dependencies**: None currently; will need PostgreSQL when completed.

#### 2.2.6 Rate Limiting

**Purpose**: Prevent abuse of the AI chat endpoint.

**How it works**:
1. Uses ioredis with sorted-set sliding windows (ZREMRANGEBYSCORE/ZADD/ZCARD): 10 requests/minute and 50 requests/day per IP.
2. If `REDIS_URL` is not set, rate limiting is silently disabled.
3. Returns `429` responses with `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers.

**Files involved**:
- `lib/ratelimit.ts` — Rate limit logic (sliding window via sorted sets)
- `lib/redis.ts` — ioredis singleton client

**Dependencies**: Self-hosted Redis via `REDIS_URL` (ioredis TCP connection).

#### 2.2.8 Public Q&A Pages (SEO/AEO)

**Purpose**: Publish approved Q&A pairs as public, search-engine-optimized pages for SEO and AI engine citation (AEO/GEO).

**How it works**:
1. Q&A pairs generated from chat sessions are saved to `qa_pairs` with status `pending`.
2. Admin reviews, edits, and approves pairs at `/admin` (protected by `ADMIN_EMAIL` env var).
3. On approval: auto-generates metaTitle, metaDescription (markdown-stripped), and optionally a DALL-E featured image.
4. Approved pairs are published at `/answers/[slug]` with ISR (revalidate 1hr).
5. Schema.org QAPage JSON-LD structured data with Question (`name`, `text`), Answer (`text`, `url`, `upvoteCount`), and citation array (Sefaria links).
6. BreadcrumbList JSON-LD on all pages: `/answers` (Home → Torah Q&A), `/answers/[slug]` (Home → Torah Q&A → Category → Question), `/topics` (Home → Topics), `/topics/[slug]` (Home → Topics → Category).
7. Browse page at `/answers` with sort controls (newest/most viewed), 30 items per page, and topics sidebar.
8. Topic index at `/topics` and per-category pages at `/topics/[slug]` with CollectionPage markup, sort controls, and topics sidebar.
9. Redis caching layer for published Q&A lookups, category stats, and sitemap slugs.
10. OpenGraph metadata with explicit image dimensions (`width`, `height`, `type`); falls back to default `opengraph-image.png` if no featured image. Facebook `fb:app_id` set globally in root layout.

**Files involved**:
- `app/answers/page.tsx` — Browse page with sort controls, 30/page pagination, topics sidebar (ISR 30min)
- `app/answers/[slug]/page.tsx` — Individual Q&A page with JSON-LD, OG metadata, topics sidebar (ISR 1hr)
- `app/answers/layout.tsx` — Marketing layout (Navbar)
- `app/topics/page.tsx` — Topic index with category cards and counts (ISR 30min)
- `app/topics/[slug]/page.tsx` — Per-category Q&A listing with CollectionPage JSON-LD
- `app/topics/layout.tsx` — Marketing layout (Navbar)
- `components/answers/AnswerContent.tsx` — Client component (ReactMarkdown, sources, breadcrumbs, related questions)
- `components/answers/QaPageLayout.tsx` — Shared layout wrapper: topics sidebar (desktop 220px nav + mobile 2-col grid) + content area
- `components/answers/TopicsSidebar.tsx` — Server component: category links with counts, active highlighting, mobile/desktop variants
- `components/answers/SortControls.tsx` — Server component: "Newest" / "Most Viewed" sort pill links
- `lib/categories.ts` — Shared Sefaria 17-category config (name, slug, description)
- `lib/db/qa.ts` — Published Q&A queries with Redis caching (getPublishedQaBySlug, getRelatedQaPairs, getPublishedQaPairs, getPublishedSlugs, getCategoryStats)

**Dependencies**: PostgreSQL, Redis (caching), `@tailwindcss/typography` (prose rendering), `react-markdown`.

#### 2.2.9 Admin Review Queue

**Purpose**: Curate Q&A pairs before publication with AI-assisted scoring.

**How it works**:
1. Admin navigates to `/admin` (server component, redirects non-admins).
2. ReviewQueue shows pending/approved/rejected tabs with paginated card list.
3. Each pair has an AI score (0-100) based on: answer length, source count, specificity, uniqueness, category coverage.
4. Expanded view shows rendered markdown preview, sources (Sefaria links), slug, score breakdown.
5. Edit mode: edit question/answer → Save (persists without approving) → returns to preview.
6. Regenerate Answer: re-runs the full RAG pipeline (intent classification → Sefaria retrieval → Claude generation) with the current system prompt, replacing the answer text and sources in place. Used to reformat old answers to the current AEO-optimized structure.
7. Generate Image: calls DALL-E gpt-image-1, shows preview, allows regeneration.
8. Approve: sets status, publishedAt, auto-generates metaTitle/metaDescription, generates image if missing.

**Files involved**:
- `app/(app)/admin/page.tsx` — Server component with admin guard
- `components/admin/ReviewQueue.tsx` — Full client component (tabs, cards, edit, image preview)
- `app/api/admin/queue/route.ts` — GET: list Q&A pairs by status with AI scoring
- `app/api/admin/qa/[id]/route.ts` — GET: detail + similar; PATCH: approve/reject/save/merge/generate-image/regenerate
- `lib/admin.ts` — isAdmin() check, computeAiScore()

**Dependencies**: PostgreSQL, `ADMIN_EMAIL` env var.

#### 2.2.10 AI Image Generation

**Purpose**: Generate featured images for published Q&A pages.

**How it works**:
1. Triggered via "Generate Image" button in admin, or auto-generated on approve if no image exists.
2. Builds a minimal prompt from the question + category only (answer text is not used).
3. Prompt requests a soft watercolor style with one or two symbolic objects, lots of whitespace, muted warm tones. No people, no text.
4. Calls OpenAI gpt-image-1 (1536×1024, medium quality, base64 response).
5. Compresses via Sharp: resize to 1200×800, WebP quality 80 (~100-200KB output).
6. Uploads to Cloudflare R2 bucket at `qa/{slug}.webp`.
7. Stores the public R2 URL in `featuredImageUrl` column.

**Files involved**:
- `lib/image-gen.ts` — generateFeaturedImage(question, categories, slug) (OpenAI + Sharp + R2 upload)

**Dependencies**: OpenAI API (`OPENAI_API_KEY`), Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`), Sharp.

#### 2.2.7 Jewish Calendar Integration (Hebcal)

**Purpose**: Provide accurate, real-time Jewish calendar data — weekly parasha, daily learning schedules, Shabbat times, halachic zmanim, holidays, and date conversion — integrated into the AI chat experience.

**How it works**:
1. The intent classifier (`lib/rag/intent.ts`) detects 7 calendar intent types from user questions (e.g., "What is this week's parasha?", "When does Shabbat start?", "What's the Daf Yomi today?").
2. For location-sensitive queries, `lib/hebcal/geo.ts` resolves the user's IP address to geographic coordinates using ip-api.com. This determines Israel vs. Diaspora (important because parasha readings can differ). Falls back to New York City for private/unresolvable IPs.
3. `lib/hebcal/resolver.ts` routes each calendar intent type to the appropriate Hebcal REST API endpoint and formats the response into a text block injected into the Claude system prompt.
4. For parasha queries, a hybrid flow also injects the Torah reading reference (e.g., "Numbers 16:1") into the Sefaria retrieval pipeline, so the AI answer includes both live calendar data AND actual source text.

**Hebcal API endpoints used** (all free, no authentication required, rate limit ~90 requests/10 seconds):

| Endpoint | Base URL | Used For |
|---|---|---|
| Calendar | `https://www.hebcal.com/hebcal` | Holidays, daily learning, general events |
| Shabbat | `https://www.hebcal.com/shabbat` | Parasha, candle-lighting, havdalah |
| Zmanim | `https://www.hebcal.com/zmanim` | All halachic times for a date/location |
| Date Converter | `https://www.hebcal.com/converter` | Hebrew↔Gregorian date conversion |

**Caching**: `lib/hebcal/client.ts` uses the same in-memory LRU cache pattern as the Sefaria client (max 500 entries, 6h default TTL, 24h for date conversions). Geolocation results are cached 24h.

**Graceful degradation**: If Hebcal API fails, the chat continues without calendar data — Claude falls back to its general knowledge with a disclaimer. If geolocation fails, defaults to New York/Diaspora.

**Files involved**:
- `lib/hebcal/types.ts` — TypeScript interfaces for Hebcal API responses (`HebcalCalendarResponse`, `HebcalEvent`, `HebcalLeyning`, `HebcalDateConversion`, `HebcalZmanimResponse`, `HebcalZmanim`, `GeoInfo`, `HebcalLocation`)
- `lib/hebcal/client.ts` — HTTP client for all 4 Hebcal endpoints with LRU cache
- `lib/hebcal/geo.ts` — IP geolocation (`resolveGeo()`, `geoToHebcalParams()`)
- `lib/hebcal/resolver.ts` — Calendar intent router (`resolveCalendar()`) with 7 resolver functions
- `lib/rag/intent.ts` — `CalendarParams` interface and calendar intent classification rules

**Dependencies**: Hebcal REST APIs (hebcal.com, free, no auth), ip-api.com (free geolocation, no auth).

---

## 3. Code Architecture

### 3.1 Directory Structure

```
aitorah/
├── app/                              # Next.js App Router pages and API routes
│   ├── (app)/                        # App-section layout (sidebar + content shell)
│   │   ├── layout.tsx                # Uses AppShell (sidebar layout) + InstallBanner
│   │   ├── search/page.tsx           # Torah Search page
│   │   └── study/page.tsx            # AI Study Partner page
│   ├── (marketing)/                  # Marketing-section layout (navbar + content)
│   │   ├── layout.tsx                # Uses Navbar
│   │   ├── page.tsx                  # Home page (hero, features, CTA)
│   │   ├── community/page.tsx        # Community/Discord page
│   │   └── contact/                  # Contact form
│   │       ├── layout.tsx            # Metadata-only layout
│   │       └── page.tsx              # Contact form UI (client component)
│   ├── (app)/admin/page.tsx           # Admin review queue (protected)
│   ├── answers/                      # Public Q&A pages (SEO)
│   │   ├── layout.tsx                # Marketing layout (Navbar)
│   │   ├── page.tsx                  # Browse page with category filters (ISR 30min)
│   │   └── [slug]/page.tsx           # Individual Q&A page (ISR 1hr, JSON-LD)
│   ├── topics/                       # Topic pages by Sefaria category
│   │   ├── layout.tsx                # Marketing layout (Navbar)
│   │   ├── page.tsx                  # Topic index with category cards (ISR 30min)
│   │   └── [slug]/page.tsx           # Per-category Q&A listing (ISR 30min)
│   ├── api/                          # API routes
│   │   ├── admin/
│   │   │   ├── queue/route.ts        # GET — admin Q&A queue with AI scoring
│   │   │   └── qa/[id]/route.ts      # GET/PATCH — Q&A detail, approve/reject/save/generate-image
│   │   ├── answers/route.ts          # GET — cached Q&A pairs
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts# NextAuth catch-all handler (GET/POST)
│   │   │   └── signup/route.ts       # POST — email/password signup
│   │   ├── chat/route.ts             # POST — RAG chat (streaming)
│   │   ├── contact/route.ts          # POST — contact form (Resend email)
│   │   ├── feedback/route.ts         # POST — RLHF feedback (stub)
│   │   ├── health/route.ts           # GET — health check
│   │   ├── search/route.ts           # GET — Sefaria full-text search
│   │   └── sessions/
│   │       ├── route.ts              # GET (list) / POST (create) study sessions
│   │       └── [id]/route.ts         # GET / PATCH / DELETE individual session
│   ├── layout.tsx                    # Root layout (fonts, GTM, Footer, AuthProvider, fb:app_id)
│   ├── globals.css                   # CSS variables, Tailwind directives, Hebrew class, slide-up animation
│   ├── manifest.ts                   # PWA web manifest (start_url: /study, standalone, maskable icon)
│   ├── opengraph-image.png           # Default OG image (1200×630)
│   ├── apple-icon.png                # Apple touch icon (180×180)
│   ├── favicon.ico                   # Multi-size favicon (transparent bg)
│   ├── llms.txt/route.ts              # Dynamic llms.txt with published Q&A listing (ISR 1hr)
│   ├── robots.ts                     # robots.txt generation
│   └── sitemap.ts                    # sitemap.xml generation (includes published Q&A + topic pages)
├── components/
│   ├── home/
│   │   └── HeroChat.tsx              # Home page chat input → redirects to /study
│   ├── layout/
│   │   ├── AppPageHeader.tsx         # Header bar for app pages (title + mobile menu)
│   │   ├── AppShell.tsx              # Full-height sidebar + content container
│   │   ├── Footer.tsx                # Site-wide footer with Sefaria + Hebcal attribution links + PWA install button (mobile)
│   │   ├── MobileMenu.tsx            # Hamburger button + slide-out drawer
│   │   ├── Navbar.tsx                # Top nav for marketing pages
│   │   └── Sidebar.tsx               # Left sidebar for app pages (Study, Search, etc.)
│   ├── pwa/
│   │   ├── InstallBanner.tsx         # Dismissible PWA install banner (60s delay, localStorage persistence)
│   │   └── InstallButton.tsx         # Persistent PWA install button for footer (mobile only)
│   ├── providers/
│   │   └── AuthProvider.tsx          # NextAuth SessionProvider wrapper (client component)
│   ├── admin/
│   │   └── ReviewQueue.tsx           # Admin review queue (tabs, cards, edit, image preview)
│   ├── answers/
│   │   ├── AnswerContent.tsx         # Q&A page content (ReactMarkdown, sources, related)
│   │   ├── QaPageLayout.tsx          # Shared layout: topics sidebar + content area
│   │   ├── TopicsSidebar.tsx         # Category nav with counts (desktop vertical / mobile 2-col grid)
│   │   └── SortControls.tsx          # Newest / Most Viewed sort pill links
│   ├── search/
│   │   └── SearchInterface.tsx       # Search UI with filters, result cards, copy button
│   ├── study/
│   │   ├── AuthModal.tsx             # Sign in / sign up modal (email+password, Google OAuth)
│   │   └── ChatInterface.tsx         # Chat UI with auth-aware session sidebar, combined mobile drawer (sessions + nav)
│   └── ui/
│       ├── BuildingBanner.tsx        # "We're building something new" CTA banner
│       ├── CopyButton.tsx            # Copy-to-clipboard button with checkmark feedback
│       └── LogoMark.tsx              # Logo image component (dark/light variants)
├── lib/
│   ├── ai/
│   │   └── prompts.ts               # System prompt builder for study partner
│   ├── admin.ts                      # Admin helpers (isAdmin, computeAiScore)
│   ├── auth.ts                       # NextAuth v5 config (Google + Credentials, pure JWT, no DB adapter)
│   ├── categories.ts                 # Sefaria 17-category config (name, slug, description)
│   ├── db/
│   │   ├── index.ts                  # Drizzle + pg Pool singleton
│   │   ├── qa.ts                     # Q&A pair CRUD operations
│   │   └── schema.ts                 # Drizzle table defs (users, accounts, sessions, qa_pairs, etc.)
│   ├── hebcal/                       # Jewish calendar integration (Hebcal REST APIs)
│   │   ├── types.ts                  # TypeScript interfaces for Hebcal API responses
│   │   ├── client.ts                 # Hebcal API client (calendar, shabbat, zmanim, converter) with LRU cache
│   │   ├── geo.ts                    # IP geolocation via ip-api.com (Israel/Diaspora detection)
│   │   └── resolver.ts              # Calendar intent → Hebcal API routing + response formatting
│   ├── rag/
│   │   ├── intent.ts                 # Intent classification via Claude Haiku (incl. 7 calendar types)
│   │   └── retrieval.ts              # Multi-strategy Sefaria retrieval pipeline
│   ├── sanity/
│   │   ├── client.ts                 # Sanity CMS client (read + write)
│   │   └── queries.ts               # GROQ queries (blog, apps, events, resources, settings)
│   ├── sefaria/
│   │   ├── client.ts                 # Sefaria API wrapper (texts, search, topics, links, etc.)
│   │   └── types.ts                  # TypeScript interfaces for all Sefaria API responses
│   ├── image-gen.ts                  # DALL-E image generation + Sharp compression + R2 upload
│   ├── usePwaInstall.ts              # Shared React hook for PWA install (beforeinstallprompt, iOS detection, localStorage dismiss)
│   ├── redis.ts                      # ioredis singleton + caching helpers
│   └── ratelimit.ts                  # ioredis sliding window rate limiting
├── drizzle/
│   ├── 0000_fuzzy_tombstone.sql      # Initial migration: qa_pairs table
│   ├── 0001_chilly_earthquake.sql    # Auth + sessions migration: users, accounts, auth_sessions, study_sessions, verification_tokens
│   ├── 0002_normal_triathlon.sql     # SEO columns on qa_pairs: status, canonicalId, metaTitle, metaDescription, featuredImageUrl, publishedAt, aiScore, aiScoreReasons
│   └── meta/                         # Drizzle Kit migration metadata
├── docs/                             # Design documents (reference only, not code)
│   ├── 01-system-architecture.md
│   ├── 02-frontend-architecture.md
│   ├── 03-backend-architecture.md
│   ├── 04-railway-deployment-guide.md
│   ├── 05-sanity-schema-design.md
│   ├── 06-website-design-document.md
│   ├── 07-rag-design.md
│   ├── 08-sefaria-api-reference.md
│   ├── 09-deploy-sefaria-rag.md
│   └── 10-hebcal-integration-design.md
├── public/                           # Static assets
│   ├── logo.png, logo-light.png, logo-transparent.png
│   ├── icon-192.png, icon-512.png    # PWA manifest icons
│   ├── torah-scroll-bg.png
│   ├── haim.jpeg
│   └── fonts/                        # (empty — fonts loaded via next/font/google)
├── types/
│   └── next-auth.d.ts                # Type augmentation: session.user.id
├── sanity/schemas/                   # Sanity CMS schema definitions (empty — not yet built)
├── Sefaria-Project-master/           # Full clone of Sefaria's codebase (reference only)
├── hebcal-es6-main/                  # Clone of @hebcal/core ES6 library (reference only, excluded from TS compilation)
├── apps/                             # Placeholder — future app directory feature
├── community/                        # Placeholder — future community feature
├── events/                           # Placeholder — future events feature
├── feedback/                         # Placeholder — future feedback storage
├── marketplace/                      # Placeholder — future marketplace feature
├── scripts/                          # Placeholder — future ingestion/utility scripts
├── search/                           # Placeholder — future search infrastructure
├── types/                            # Placeholder — future shared types
├── webhooks/                         # Placeholder — future webhook handlers
├── mockup/index.html                 # Static HTML mockup (pre-Next.js prototype)
├── DEPLOY.md                         # Deployment instructions
├── railway.json                      # Railway deployment config
├── drizzle.config.ts                 # Drizzle Kit config
├── next.config.mjs                   # Next.js config (standalone output, Sanity images, serverExternalPackages: ioredis, @ducanh2912/next-pwa)
├── tailwind.config.ts                # Tailwind config (custom theme + @tailwindcss/typography)
├── tsconfig.json                     # TypeScript config
├── postcss.config.mjs                # PostCSS config
└── package.json                      # Dependencies and scripts
```

⚠️ **Oddly-named directories**: `resources}`, `sanity}}`, `settings}` exist at the project root with trailing curly braces. These are empty and appear to be accidental directory creation artifacts. Safe to delete.

### 3.2 Shared / Core Components

| Component / Module | File | Purpose | Imported By |
|---|---|---|---|
| `LogoMark` | `components/ui/LogoMark.tsx` | Renders the AI Torah logo (dark/light variants) | `Navbar`, `Sidebar`, `MobileMenu`, `Footer`, `ChatInterface` |
| `CopyButton` | `components/ui/CopyButton.tsx` | Copy-to-clipboard with checkmark feedback | `ChatInterface`, `SearchInterface` |
| `BuildingBanner` | `components/ui/BuildingBanner.tsx` | CTA banner linking to `/contact` | Not currently imported (available for use) |
| `InstallBanner` | `components/pwa/InstallBanner.tsx` | Dismissible PWA install banner (60s delay, dismissed → localStorage) | `app/(app)/layout.tsx` |
| `InstallButton` | `components/pwa/InstallButton.tsx` | Persistent PWA install button (mobile only) | `Footer` |
| `usePwaInstall` | `lib/usePwaInstall.ts` | Shared hook: `beforeinstallprompt` capture, iOS detection, standalone check, localStorage dismiss | `InstallBanner`, `InstallButton` |
| `QaPageLayout` | `components/answers/QaPageLayout.tsx` | Topics sidebar + content wrapper (desktop: flex row; mobile: stacked) | `answers/page.tsx`, `answers/[slug]/page.tsx`, `topics/[slug]/page.tsx` |
| `TopicsSidebar` | `components/answers/TopicsSidebar.tsx` | Category navigation with counts. `mobile` prop toggles 2-col grid (md:hidden) vs vertical nav (hidden md:block) | `QaPageLayout` |
| `SortControls` | `components/answers/SortControls.tsx` | Sort pill links (Newest / Most Viewed) with `currentSort` + `basePath` props | `answers/page.tsx`, `topics/[slug]/page.tsx` |
| `AuthProvider` | `components/providers/AuthProvider.tsx` | NextAuth `SessionProvider` wrapper | `app/layout.tsx` (root) |
| `AuthModal` | `components/study/AuthModal.tsx` | Sign in / sign up modal (email + Google OAuth) | `ChatInterface` |
| `AppShell` | `components/layout/AppShell.tsx` | Full-height `Sidebar + content` container | `app/(app)/layout.tsx` |
| `AppPageHeader` | `components/layout/AppPageHeader.tsx` | Page header with title + mobile menu | `study/page.tsx` (desktop only), `search/page.tsx` |
| `Navbar` | `components/layout/Navbar.tsx` | Top navigation for marketing pages | `app/(marketing)/layout.tsx` |
| `Footer` | `components/layout/Footer.tsx` | Site-wide footer with Sefaria + Hebcal attribution links | `app/layout.tsx` (root) |
| `Sidebar` | `components/layout/Sidebar.tsx` | Left sidebar navigation for app pages | `AppShell` |
| `MobileMenu` | `components/layout/MobileMenu.tsx` | Hamburger button + drawer overlay | `Navbar`, `AppPageHeader` |
| `auth` / `handlers` | `lib/auth.ts` | NextAuth v5 config (pure JWT, Google + Credentials) | `api/auth/[...nextauth]`, `api/sessions/*`, `api/auth/signup` |
| `getDb()` | `lib/db/index.ts` | Returns Drizzle ORM instance with pg Pool | `lib/db/qa.ts`, `lib/auth.ts` (credentials only), session API routes |
| `checkRateLimit()` | `lib/ratelimit.ts` | IP-based rate limiting via Upstash Redis | `app/api/chat/route.ts` |
| `classifyIntent()` | `lib/rag/intent.ts` | Classifies user question into structured intent (incl. 7 calendar types) | `app/api/chat/route.ts` |
| `retrieve()` | `lib/rag/retrieval.ts` | Full RAG retrieval pipeline (accepts optional pre-classified intent) | `app/api/chat/route.ts` |
| `buildStudyPartnerSystemPrompt()` | `lib/ai/prompts.ts` | Builds Claude system prompt with sources + optional calendar context | `app/api/chat/route.ts` |
| `resolveCalendar()` | `lib/hebcal/resolver.ts` | Routes calendar intent to Hebcal API, returns formatted context | `app/api/chat/route.ts` |
| `resolveGeo()` | `lib/hebcal/geo.ts` | Resolves user IP to GeoInfo (lat/lon, timezone, Israel flag) | `app/api/chat/route.ts` |
| Hebcal client functions | `lib/hebcal/client.ts` | All Hebcal API HTTP calls (cached) | `lib/hebcal/resolver.ts` |
| `sanityClient` / `sanityWriteClient` | `lib/sanity/client.ts` | Sanity CMS read/write clients | ⚠️ Not currently imported by any page |
| GROQ queries | `lib/sanity/queries.ts` | Pre-built Sanity queries | ⚠️ Not currently imported by any page |
| Sefaria client functions | `lib/sefaria/client.ts` | All Sefaria API HTTP calls (cached) | `lib/rag/retrieval.ts`, `app/api/search/route.ts` |

### 3.3 Data Layer

**ORM**: Drizzle ORM (`drizzle-orm` + `drizzle-kit`) with `pg` (node-postgres) driver.

**Data sources**:

| Source | Type | Connection | Status |
|---|---|---|---|
| PostgreSQL | Database | `DATABASE_URL` env var | Optional — app works without it (Q&A caching + auth + sessions disabled) |
| Sefaria API | External REST API | `https://www.sefaria.org` (no auth required) | Active — primary Torah text source |
| Hebcal API | External REST API | `https://www.hebcal.com` (no auth required) | Active — Jewish calendar data (parasha, zmanim, holidays, dates) |
| ip-api.com | External REST API | `http://ip-api.com` (no auth, free tier) | Active — IP geolocation for Israel/Diaspora detection |
| Anthropic Claude | External API | `ANTHROPIC_API_KEY` env var | Active — powers chat and intent classification |
| Redis (ioredis) | Self-hosted Redis | `REDIS_URL` env var (TCP) | Optional — rate limiting + Q&A caching disabled without it |
| OpenAI | External API | `OPENAI_API_KEY` env var | Active — DALL-E image generation for Q&A pages |
| Cloudflare R2 | Object storage | `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME` | Active — featured image storage |
| Resend | Email API | `RESEND_API_KEY` env var | Active — contact form emails |
| Sanity CMS | Headless CMS | `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` | Configured but unused — no content or pages consume it |

**Database schema** (6 tables — `drizzle/0000_fuzzy_tombstone.sql` + `drizzle/0001_chilly_earthquake.sql`):

```
users
├── id                  uuid        PK, auto-generated
├── name                text        nullable
├── email               text        NOT NULL
├── email_verified      timestamptz nullable
├── image               text        nullable
├── password_hash       text        nullable — bcrypt hash (null for OAuth-only users)
├── created_at          timestamptz default now()
│
└── UNIQUE INDEX idx_users_email (email)

accounts (OAuth provider accounts)
├── id                  uuid        PK, auto-generated
├── user_id             uuid        FK → users.id ON DELETE CASCADE
├── type                text        NOT NULL — "oauth" | "oidc" | "email"
├── provider            text        NOT NULL — "google" | "credentials"
├── provider_account_id text        NOT NULL
├── refresh_token       text        nullable
├── access_token        text        nullable
├── expires_at          integer     nullable
├── token_type          text        nullable
├── scope               text        nullable
├── id_token            text        nullable
├── session_state       text        nullable
│
└── INDEX idx_accounts_user (user_id)

auth_sessions (NextAuth database sessions — mostly unused with JWT strategy)
├── session_token       text        PK
├── user_id             uuid        FK → users.id ON DELETE CASCADE
└── expires             timestamptz NOT NULL

verification_tokens
├── identifier          text        NOT NULL
├── token               text        NOT NULL
├── expires             timestamptz NOT NULL
│
└── UNIQUE INDEX idx_vt_token (token)

study_sessions (persisted chat sessions)
├── id                  uuid        PK, auto-generated
├── user_id             uuid        FK → users.id ON DELETE CASCADE
├── title               text        nullable — auto-generated from first question
├── messages            text        NOT NULL — JSON stringified array of {role, content, sources?}
├── created_at          timestamptz default now()
├── updated_at          timestamptz default now()
│
├── INDEX idx_study_sessions_user    (user_id)
└── INDEX idx_study_sessions_updated (updated_at)

qa_pairs
├── id                  uuid        PK, auto-generated
├── question            text        NOT NULL — original user question
├── question_normalized text        NOT NULL — lowercase, punctuation-stripped
├── answer_markdown     text        NOT NULL — full AI-generated answer
├── source_refs         text[]      NOT NULL — array of Sefaria refs (e.g. "Genesis 1:1")
├── topics              text[]      nullable — topic slugs from retrieval
├── categories          text[]      nullable — source categories (e.g. "Tanakh", "Talmud")
├── language            text        default 'en'
├── view_count          integer     default 0 — incremented on each access
├── slug                text        UNIQUE — URL-friendly question slug
├── similarity          real        nullable — reserved for future similarity scoring
├── status              text        NOT NULL default 'pending' — pending/approved/rejected
├── canonical_id        uuid        nullable — FK to canonical Q&A (for merged duplicates)
├── meta_title          text        nullable — SEO page title
├── meta_description    text        nullable — SEO meta description (markdown-stripped)
├── featured_image_url  text        nullable — R2 URL for DALL-E generated image
├── published_at        timestamptz nullable — set on approval
├── ai_score            integer     nullable — 0-100 quality score
├── ai_score_reasons    jsonb       nullable — score breakdown (answerLength, sourceCount, etc.)
├── created_at          timestamptz default now()
│
├── INDEX idx_qa_slug      (slug)
├── INDEX idx_qa_created   (created_at)
├── INDEX idx_qa_status    (status)
└── INDEX idx_qa_published (published_at)
```

**Legacy TypeScript interfaces** in `lib/db/schema.ts` define types for future tables: `TorahText`, `MarketplaceListing`, `Order`, `RlhfFeedback`. These are **not backed by database tables** — they are aspirational type definitions only.

**Sefaria API caching**: `lib/sefaria/client.ts` implements an in-memory LRU cache (max 500 entries) with configurable TTL. Text lookups cache for 24 hours; search results cache for 1 hour. Cache is per-process and resets on deploy.

**Hebcal API caching**: `lib/hebcal/client.ts` uses the same in-memory LRU cache pattern (max 500 entries). Calendar/Shabbat/Zmanim responses cache for 6 hours; date conversions cache for 24 hours. Geolocation results (`lib/hebcal/geo.ts`) are cached separately for 24 hours (max 1000 entries). All caches are per-process and reset on deploy.

### 3.4 UI Structure

#### Screens / Pages

| Route | Page File | Layout | Description |
|---|---|---|---|
| `/` | `app/(marketing)/page.tsx` | Marketing (Navbar) | Home page: hero with chat input, feature cards, how-it-works, CTA |
| `/study` | `app/(app)/study/page.tsx` | App (Sidebar) | AI Study Partner: chat interface with session sidebar, auth modals |
| `/search` | `app/(app)/search/page.tsx` | App (Sidebar) | Torah Search: search bar, filters, result cards |
| `/answers` | `app/answers/page.tsx` | Marketing (Navbar) | Q&A browse: sort controls, 30/page, topics sidebar |
| `/answers/[slug]` | `app/answers/[slug]/page.tsx` | Marketing (Navbar) | Individual Q&A page with JSON-LD, sources, related, topics sidebar |
| `/topics` | `app/topics/page.tsx` | Marketing (Navbar) | Topic index: 17 Sefaria categories with counts |
| `/topics/[slug]` | `app/topics/[slug]/page.tsx` | Marketing (Navbar) | Per-category Q&A listing with sort controls and topics sidebar |
| `/admin` | `app/(app)/admin/page.tsx` | App (Sidebar) | Admin review queue (protected by ADMIN_EMAIL) |
| `/community` | `app/(marketing)/community/page.tsx` | Marketing (Navbar) | Community: Discord info, channels, audience types |
| `/contact` | `app/(marketing)/contact/page.tsx` | Marketing (Navbar) | Contact form: name, email, interests, message |

#### Key User Flows

**Flow 1: Ask a Torah question (from home page)**
1. User lands on `/` → sees hero section with chat input (`HeroChat`).
2. Types question → presses Enter or clicks send.
3. Redirected to `/study?q=<encoded question>`.
4. `ChatInterface` reads `q` param, auto-sends the message.
5. Answer streams in with cited sources. User can expand sources panel to view Hebrew/English text and "View on Sefaria" links.
6. After first response, if not authenticated, an auth prompt card appears. Input is disabled until sign in.
7. Once signed in, the conversation is auto-saved and the user can continue with follow-up questions.

**Flow 1b: Sign up / Sign in**
1. User clicks "Sign in" (sidebar bottom, auth prompt card, or mobile header).
2. Auth modal opens with Sign In / Sign Up tabs.
3. User can sign in with email+password or Google OAuth.
4. On successful auth, modal closes, session list loads, current conversation is saved.
5. Sessions appear in left sidebar (desktop) or slide-out drawer (mobile).

**Flow 2: Search Torah texts**
1. User navigates to `/search` via sidebar or navbar.
2. Types a query → selects a category filter (optional) → presses Enter or clicks Search.
3. Results appear as cards showing: reference, category, relevance %, Hebrew text, English text.
4. Each result has a "View on Sefaria" link to the original text.

**Flow 3: Contact / Get Involved**
1. User navigates to `/contact`.
2. Reads the vision and "What's Coming" sections.
3. Fills out name (required), email (required), phone, interests (multi-select), message.
4. Submits → sees "Thank you!" confirmation with link back to home.

#### Layout Anatomy

```
Root Layout (app/layout.tsx)
├── GTM script (head)
├── JSON-LD structured data (Organization + WebSite)
├── Font CSS variables (body class)
├── AuthProvider (NextAuth SessionProvider)
│   ├── {children}                    ← route group layout injected here
│   └── Footer (components/layout/Footer.tsx)

Marketing Layout (app/(marketing)/layout.tsx)
├── Navbar (components/layout/Navbar.tsx)
│   ├── Logo + "AI Torah" link
│   ├── Nav links: Study, Search, Q&A, Topics, Community, Contact
│   └── Mobile: hamburger → MobileMenuDrawer
└── <main>{children}</main>

App Layout (app/(app)/layout.tsx)
└── AppShell (components/layout/AppShell.tsx)
    ├── Sidebar (components/layout/Sidebar.tsx)    ← hidden on mobile
    │   ├── Logo + "AI Torah" link
    │   └── Nav: Study Partner, Torah Search, Q&A, Topics, Community, Contact
    └── Content area
        └── {children}                             ← individual page
            └── AppPageHeader (title + mobile menu)

Study Page (/study) — ChatInterface internal layout:
├── AppPageHeader (desktop only — hidden on mobile via `hidden md:block`)
├── Session sidebar (w-60, hidden on mobile)
│   ├── "New Session" button
│   ├── Session list (titles, timestamps, delete buttons)
│   └── Bottom: sign-in button or user avatar + sign out
├── Mobile: single combined drawer (triggered by hamburger in mobile header)
│   ├── Top: Logo header
│   ├── Sessions section (New Session button, session list, sign-in/user info)
│   ├── Divider
│   └── Nav links (Study Partner, Torah Search, Community, Contact)
├── Mobile header: hamburger (opens combined drawer) | "Study Partner" title
└── Main chat area
    ├── Welcome landing (centered, shown when no messages)
    └── Chat panel (messages, sources, copy buttons, auth prompt, input)
```

#### Navigation

- **Marketing pages** (`/`, `/community`, `/contact`): Top `Navbar` with horizontal links. Mobile: hamburger opens `MobileMenuDrawer` (left slide-out).
- **App pages** (`/search`): Left `Sidebar` (220px, hidden on mobile). Mobile: `AppPageHeader` includes a hamburger that opens the same `MobileMenuDrawer`.
- **Study page** (`/study`): Left `Sidebar` (220px, hidden on mobile) + a session sidebar (240px) within ChatInterface. On mobile, `AppPageHeader` is hidden; ChatInterface renders its own mobile header (hamburger + title) and a **combined drawer** that merges the session list (top) with site navigation links (bottom), separated by a divider. This eliminates the need for two separate drawers on mobile.
- Nav items are defined as constants in `Sidebar.tsx` (line 7), `MobileMenu.tsx` (line 6), `Navbar.tsx` (line 22), and inline in `ChatInterface.tsx` (mobile combined drawer).
- No hard auth guards — all pages are publicly accessible. The study page prompts sign-in after first chat exchange but doesn't force redirect.

#### State Management

No global state management library. Auth state is provided by NextAuth's `SessionProvider` (context-based). All other state is local to components via React `useState`:
- `ChatInterface`: messages array, input text, streaming state, open source panels, session list, current session ID, auth modal visibility, combined mobile drawer state (single `mobileDrawerOpen` controls both sessions and nav)
- `SearchInterface`: query, active filter, results, search state
- `ContactPage`: form fields, submission state
- `HeroChat`: input text
- `Navbar`, `AppPageHeader`: mobile menu open/close

---

## 4. Field / Variable / Column Registry

### 4.1 Database Columns — `qa_pairs` table

| Column | Type | Defined In | Read In | Written In | Transformations | Purpose |
|---|---|---|---|---|---|---|
| `id` | `uuid` | `lib/db/schema.ts:4` | `lib/db/qa.ts:61,89` | Auto-generated (PK) | — | Primary key |
| `question` | `text` | `lib/db/schema.ts:5` | `lib/db/qa.ts:103` | `lib/db/qa.ts:30` | — | Original user question text |
| `question_normalized` | `text` | `lib/db/schema.ts:6` | `lib/db/qa.ts:52` (WHERE clause) | `lib/db/qa.ts:31` | `normalizeQuestion()`: lowercase, strip punctuation, collapse whitespace | Normalized form for exact-match lookup |
| `answer_markdown` | `text` | `lib/db/schema.ts:7` | `lib/db/qa.ts:58` | `lib/db/qa.ts:32` | — | Full AI-generated Markdown answer |
| `source_refs` | `text[]` | `lib/db/schema.ts:8` | `lib/db/qa.ts:59` | `lib/db/qa.ts:33` | `sources.map(s => s.ref)` | Array of Sefaria reference strings |
| `topics` | `text[]` | `lib/db/schema.ts:9` | `lib/db/qa.ts:104` | `lib/db/qa.ts:34` | Extracted from `source.topic_slug` | Topic slugs (e.g. "shabbat", "prayer") |
| `categories` | `text[]` | `lib/db/schema.ts:10` | `lib/db/qa.ts:105` | `lib/db/qa.ts:35` | Flattened from `source.categories` | Source categories (e.g. "Tanakh", "Talmud") |
| `language` | `text` | `lib/db/schema.ts:11` | — | Default `'en'` | — | Language of the Q&A pair |
| `view_count` | `integer` | `lib/db/schema.ts:12` | `lib/db/qa.ts:106` | `lib/db/qa.ts:60,89` (increment) | `view_count + 1` on access | Access counter |
| `slug` | `text` | `lib/db/schema.ts:13` | `lib/db/qa.ts:82` (WHERE), `103` | `lib/db/qa.ts:37` | `generateSlug()`: lowercase, strip special chars, hyphenate, truncate 80 chars | URL-friendly identifier |
| `similarity` | `real` | `lib/db/schema.ts:14` | — | — | — | Reserved for future vector similarity score |
| `created_at` | `timestamptz` | `lib/db/schema.ts:15` | `lib/db/qa.ts:106` | Default `now()` | — | Creation timestamp |

### 4.2 API Request/Response Fields

#### POST `/api/chat`

**Request**:
| Field | Type | Source | Purpose |
|---|---|---|---|
| `messages` | `Array<{role: string, content: string}>` | Client (`ChatInterface.tsx:47`) | Full conversation history |
| `messages[].role` | `"user" \| "assistant"` | Client | Message sender |
| `messages[].content` | `string` | Client | Message text |

**Response** (streaming text):
| Field | Type | Purpose |
|---|---|---|
| `<!--SOURCES:...-->` prefix | JSON string | Source metadata (ref, type, similarity, hebrew, english) embedded in stream |
| Body text | Markdown string | AI-generated answer |

#### GET `/api/search`

**Request (query params)**:
| Field | Type | Source | Purpose |
|---|---|---|---|
| `q` | `string` | Client (`SearchInterface.tsx:30`) | Search query (required) |
| `source` | `string` | Client filter | Category filter: tanakh, mishnah, gemara, rishonim, acharonim |
| `limit` | `string` (int) | Client | Max results (default 10, max 50) |

**Response**:
| Field | Type | Purpose |
|---|---|---|
| `results` | `Array<Result>` | Search results |
| `results[].ref` | `string` | Sefaria reference (e.g. "Genesis 1:1") |
| `results[].type` | `string` | Category path (e.g. "Tanakh · Torah · Genesis") |
| `results[].source` | `string` | Top-level category |
| `results[].similarity` | `number` (1-99) | Relevance score |
| `results[].hebrew` | `string` | Hebrew text snippet (max 300 chars) |
| `results[].english` | `string` | English text snippet (max 300 chars) |
| `results[].sefaria_url` | `string` | Link to text on sefaria.org |
| `total` | `number` | Total results found |
| `query` | `string` | Echo of the search query |

#### POST `/api/contact`

**Request**:
| Field | Type | Validation | Purpose |
|---|---|---|---|
| `name` | `string` | `z.string().min(1)` | Contact name (required) |
| `email` | `string` | `z.string().email()` | Contact email (required) |
| `phone` | `string` | `z.string().optional()` | Phone number |
| `message` | `string` | `z.string().optional()` | Free-text message |
| `interests` | `string[]` | `z.array(z.string())` | Selected interest tags |

#### POST `/api/feedback`

**Request**:
| Field | Type | Validation | Purpose |
|---|---|---|---|
| `sessionId` | `string` | `z.string().uuid()` | Chat session identifier |
| `messageIdx` | `number` | `z.number().int().min(0)` | Index of the rated message |
| `rating` | `number` | `z.number().int().min(1).max(5)` | Quality rating |
| `correction` | `string` | `z.string().optional()` | User-provided correction text |

#### GET `/api/answers`

**Query params**: `slug` (optional). Without slug, returns 50 most recent Q&A pairs.

#### POST `/api/auth/signup`

**Request**:
| Field | Type | Validation | Purpose |
|---|---|---|---|
| `name` | `string` | optional | Display name |
| `email` | `string` | required, email format | User email (unique) |
| `password` | `string` | required, 8+ chars | Password (hashed with bcrypt-12) |

**Response**: `201` on success, `400` if validation fails, `409` if email exists.

#### GET/POST `/api/auth/[...nextauth]`

NextAuth v5 catch-all handler. Handles OAuth callbacks, CSRF, session retrieval. Not called directly by client code — managed by `next-auth/react` methods (`signIn()`, `signOut()`, `useSession()`).

#### GET `/api/sessions`

Returns authenticated user's study sessions (max 50, ordered by `updatedAt` desc).

**Response**: Array of `{ id, title, updatedAt }`.

#### POST `/api/sessions`

**Request**:
| Field | Type | Purpose |
|---|---|---|
| `title` | `string` | Session title (auto-generated from first question) |
| `messages` | `Array<Message>` | Full message history (JSON stringified on save) |

**Response**: `{ id, title, updatedAt }`.

#### GET/PATCH/DELETE `/api/sessions/[id]`

- **GET**: Returns `{ id, title, messages (parsed), createdAt, updatedAt }`. 404 if not owned by user.
- **PATCH**: Body `{ title?, messages? }`. Updates `updatedAt`. Returns `{ id, title, updatedAt }`.
- **DELETE**: Removes session. Returns `204`.

All session routes require authentication (return `401` if not signed in) and enforce user ownership.

### 4.3 Environment Variables

| Variable | Required | Used In | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | `app/api/chat/route.ts:8` | Anthropic API authentication |
| `DATABASE_URL` | No | `lib/db/index.ts:9` | PostgreSQL connection string |
| `RESEND_API_KEY` | Yes (for contact) | `app/api/contact/route.ts:5` | Resend email API key |
| `CONTACT_EMAIL` | Yes (for contact) | `app/api/contact/route.ts:26` | Recipient of contact form emails |
| `REDIS_URL` | No | `lib/redis.ts` | Redis connection URL for rate limiting + Q&A caching (ioredis TCP) |
| `OPENAI_API_KEY` | No | `lib/image-gen.ts` | OpenAI API key for DALL-E image generation |
| `R2_ACCOUNT_ID` | No | `lib/image-gen.ts` | Cloudflare account ID for R2 storage |
| `R2_ACCESS_KEY_ID` | No | `lib/image-gen.ts` | R2 API access key |
| `R2_SECRET_ACCESS_KEY` | No | `lib/image-gen.ts` | R2 API secret key |
| `R2_BUCKET_NAME` | No | `lib/image-gen.ts` | R2 bucket name (e.g. `aitorah-images`) |
| `R2_PUBLIC_URL` | No | `lib/image-gen.ts` | Public URL for R2 bucket (e.g. `https://images.aitorah.ai`) |
| `ADMIN_EMAIL` | No | `lib/admin.ts` | Email address authorized for admin access |
| `NEXTAUTH_SECRET` | Yes (for auth) | `lib/auth.ts` | JWT signing secret for NextAuth (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes (for auth) | `lib/auth.ts`, `app/robots.ts`, `app/sitemap.ts` | Full URL with protocol (e.g. `https://aitorah.ai`). `trustHost: true` is set as fallback. |
| `GOOGLE_CLIENT_ID` | No | `lib/auth.ts` | Google OAuth client ID (hides Google button if missing) |
| `GOOGLE_CLIENT_SECRET` | No | `lib/auth.ts` | Google OAuth client secret |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | No (unused) | `lib/sanity/client.ts:4` | Sanity project ID |
| `NEXT_PUBLIC_SANITY_DATASET` | No (unused) | `lib/sanity/client.ts:5` | Sanity dataset (default: "production") |
| `SANITY_API_TOKEN` | No (unused) | `lib/sanity/client.ts:12` | Sanity write token |
| `DISCORD_CLIENT_ID` | No (unused) | — | Reserved for Discord OAuth |
| `DISCORD_CLIENT_SECRET` | No (unused) | — | Reserved for Discord OAuth |
| `OPENAI_API_KEY` | No | `lib/image-gen.ts` | OpenAI API for DALL-E image generation |
| `STRIPE_SECRET_KEY` | No (unused) | — | Reserved for marketplace |
| `STRIPE_WEBHOOK_SECRET` | No (unused) | — | Reserved for Stripe webhooks |
| `DISCOURSE_SSO_SECRET` | No (unused) | — | Reserved for Discourse SSO |
| `DISCOURSE_API_KEY` | No (unused) | — | Reserved for Discourse API |
| `DISCOURSE_URL` | No (unused) | — | Reserved for Discourse URL |

### 4.4 Key Constants and Internal Types

| Name | Type | Defined In | Purpose |
|---|---|---|---|
| `MAX_SOURCES` | `8` | `lib/rag/retrieval.ts:18` | Max sources returned by the retrieval pipeline |
| `IntentType` | Union type | `lib/rag/intent.ts:3-17` | Intent categories: text_lookup, topic_exploration, commentary_request, comparative, halachic, word_definition, general + 7 calendar types (calendar_parasha, calendar_learning, calendar_shabbat, calendar_zmanim, calendar_holiday, calendar_date, calendar_general) |
| `CalendarParams` | Interface | `lib/rag/intent.ts:19-25` | Calendar-specific params: needs_location, date_reference, hebrew_date, gregorian_date, learning_type |
| `ParsedIntent` | Interface | `lib/rag/intent.ts:27-35` | Structured intent: type, refs, topics, search_terms_en, search_terms_he, category_hint, calendar_params |
| `CalendarContext` | Interface | `lib/hebcal/resolver.ts:11-15` | Calendar resolution result: text (formatted context), location?, parashaRef? |
| `GeoInfo` | Interface | `lib/hebcal/types.ts` | Geolocation result: geonameid, lat/lon, city, country, timezone, isIsrael |
| `RetrievedSource` | Interface | `lib/sefaria/types.ts:109-120` | Retrieved source: ref, heRef, text_en, text_he, category, categories, score, source_type, link_type?, topic_slug? |
| `Source` (client) | Type | `components/study/ChatInterface.tsx:6` | Client-side source: ref, type, similarity, hebrew, english |
| `Result` (search) | Type | `components/search/SearchInterface.tsx:5-12` | Search result: ref, type, source, similarity, hebrew, english, sefaria_url |
| `HINTS` | `string[]` | `components/study/ChatInterface.tsx:14` | Suggested question prompts for the chat UI |
| `FILTERS` | `string[]` | `components/search/SearchInterface.tsx:15` | Search category filters: All Texts, Tanakh, Mishnah, Gemara, Rishonim, Acharonim |
| `INTERESTS` | `string[]` | `app/(marketing)/contact/page.tsx:6-12` | Contact form interest options |
| `navItems` | Array | `components/layout/Sidebar.tsx:7-14` | Sidebar navigation items: Study Partner, Torah Search, Q&A, Topics, Community, Contact |
| `menuItems` | Array | `components/layout/MobileMenu.tsx:6-13` | Mobile menu items: Study, Search, Q&A, Topics, Community, Contact |
| `CATEGORIES` | Array | `lib/categories.ts` | Sefaria's 17 categories with name, slug, description |

### 4.5 CSS Custom Properties (Design Tokens)

Defined in `app/globals.css:5-23`, consumed globally via `var(--name)`:

| Variable | Value | Purpose |
|---|---|---|
| `--primary` | `#1a3a5c` | Dark navy — primary brand color |
| `--primary-light` | `#2563eb` | Blue — hover states, active elements |
| `--accent` | `#b5914a` | Gold — accent, CTA buttons |
| `--accent-dark` | `#8a6a2e` | Dark gold — hover on accent buttons |
| `--accent-light` | `#f0d080` | Light gold — assistant avatar bg, highlight |
| `--accent-text` | `#7a5c1e` | Gold text — source refs, labels |
| `--bg` | `#fafaf8` | Warm off-white — page background |
| `--surface` | `#ffffff` | White — card/input backgrounds |
| `--surface-alt` | `#f4f3ef` | Light beige — alternate surface, hover bg |
| `--text` | `#1a1a1a` | Near-black — primary text |
| `--text-sec` | `#6b7280` | Gray — secondary text, descriptions |
| `--text-hebrew` | `#1a3a5c` | Navy — Hebrew text |
| `--border` | `#e5e3db` | Warm gray — borders, dividers |
| `--radius` | `8px` | Default border radius |

---

## 5. Local Development

### Prerequisites

- **Node.js** 20+ (developed on v22.19.0)
- **npm** (comes with Node.js)
- An **Anthropic API key** (`ANTHROPIC_API_KEY`) — required for the chat feature
- A **Resend API key** (`RESEND_API_KEY`) — required for the contact form
- Optional: PostgreSQL, Upstash Redis (features degrade gracefully without them)

### Setup from Fresh Clone

```bash
# 1. Clone and install
git clone https://github.com/Haimjcu/aitorah.git
cd aitorah
npm install

# 2. Configure environment
# .env.local already exists with placeholder values — fill in your API keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   RESEND_API_KEY=re_...
#   CONTACT_EMAIL=your-email@example.com

# 3. Run dev server
npm run dev
# → Open http://localhost:3000
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (port 3000) |
| `npm run build` | Production build (standalone output, `--webpack` flag for PWA service worker generation) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Database Setup (Optional)

If you want Q&A caching to work locally:

```bash
# 1. Start a PostgreSQL instance (e.g., Docker)
docker run -d --name aitorah-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16

# 2. Set DATABASE_URL in .env.local
DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres

# 3. Run migrations
npx drizzle-kit push
```

### Tests

⚠️ **No test suite exists.** There are no unit, integration, or e2e tests in the project.

### Common Gotchas

1. **`.env.local` contains real API keys** — the file is committed to git with actual Anthropic and Resend keys. These should be rotated and the file should be `.gitignore`d (it currently is `.gitignore`d, but was committed before the ignore rule was added).
2. **Sefaria-Project-master** and **hebcal-es6-main** are full clones of the Sefaria and Hebcal codebases included as reference. Both are excluded from TypeScript compilation (`tsconfig.json` excludes them) but are tracked in git.
3. **Empty placeholder directories** (`apps/`, `community/`, `events/`, `feedback/`, `marketplace/`, `scripts/`, `search/`, `types/`, `webhooks/`) exist for planned features. They are empty.
4. **Oddly-named directories** (`resources}`, `sanity}}`, `settings}`) with trailing braces appear to be accidental.
5. **Sanity CMS is configured but unused** — the client and GROQ queries exist but no page imports them and no Sanity project is set up.
6. **The Sefaria search API requires no authentication** — it's a public API. No API key needed.
7. **In-memory caches reset on every deploy/restart** — Sefaria, Hebcal, and geolocation caches are all per-process with no persistent cache layer.
8. **Hebcal APIs are free but rate-limited** — ~90 requests per 10 seconds. The in-memory LRU cache (6h TTL) prevents hitting this limit under normal usage.
9. **ip-api.com free tier is HTTP only** — the geolocation service uses `http://` (not HTTPS) on the free tier. This is acceptable since only the user's IP is sent (no secrets).
10. **PWA build requires `--webpack` flag** — `@ducanh2912/next-pwa` uses a webpack plugin incompatible with Next.js 16's default Turbopack. The `build` script in `package.json` already includes `--webpack`. Dev mode (`npm run dev`) uses Turbopack as normal (PWA is disabled in dev via `disable: process.env.NODE_ENV === 'development'`).
11. **Service worker files are gitignored** — `public/sw.js`, `public/workbox-*.js` are generated at build time and listed in `.gitignore`. Do not commit them.

---

## 6. Deployment

### Hosting

- **Platform**: [Railway](https://railway.app)
- **Builder**: Nixpacks (auto-detected Next.js)
- **Output mode**: Standalone (`next.config.mjs` → `output: 'standalone'`)

### Branch → Environment Mapping

| Branch | Environment | URL |
|---|---|---|
| `main` | Production | `aitorah.ai` (custom domain) / Railway-provided URL |

Railway auto-deploys on every push to `main`.

### Deployment Config

**`railway.json`**:
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && HOSTNAME=0.0.0.0 node .next/standalone/server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

The start command copies static assets and public files into the standalone build, then starts the Node.js server.

### Required Environment Variables (Production)

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Required — chat won't work without it |
| `RESEND_API_KEY` | Required — contact form won't send emails |
| `CONTACT_EMAIL` | Required — where contact emails are delivered |
| `NEXTAUTH_URL` | Set to `https://aitorah.ai` |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |

### Optional Environment Variables (Production)

| Variable | Feature it enables |
|---|---|
| `DATABASE_URL` | Q&A caching, authentication, session persistence |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in (hides button if missing) |
| `REDIS_URL` | Rate limiting + Q&A page caching |
| `OPENAI_API_KEY` | DALL-E featured image generation |
| `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME` + `R2_PUBLIC_URL` | Cloudflare R2 image storage |
| `ADMIN_EMAIL` | Admin review queue access |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` | CMS content (not yet used) |

### Deployment Steps

```bash
# Push to main triggers auto-deploy
git push origin main

# Verify
curl https://aitorah.ai/api/health
# → {"status":"ok","timestamp":"..."}
```

### Health Check

Set in Railway: service → Settings → Health Check Path → `/api/health`

### Rollback

Railway dashboard → service → Deployments tab → click a previous deployment → "Redeploy".

### Database Migration Process

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push to database (Railway PostgreSQL)
DATABASE_URL=<railway-url> npx drizzle-kit push
```

⚠️ There is no automated migration step in the deploy pipeline. Migrations must be run manually.

### Post-Deploy Verification

1. Check health: `GET /api/health` → `{"status":"ok"}`
2. Test chat: Navigate to `/study`, ask "What does Genesis 1:1 say?"
3. Test calendar: Navigate to `/study`, ask "What is this week's parasha?" — should return parasha name, leyning, Shabbat times
4. Test search: Navigate to `/search`, search for "shabbat"
5. Test contact: Navigate to `/contact`, submit test form, verify email received

---

## Appendix: Feature Status Matrix

| Feature | Status | What's Built | What's Missing |
|---|---|---|---|
| Home page | **Working** | Full marketing page with hero chat, "Ask AI Torah" CTAs, OG image | — |
| AI Study Partner | **Working** | RAG pipeline, streaming chat, source panel, session sidebar, copy button | — |
| Authentication | **Working** (Google needs env vars, email/pw needs DB) | NextAuth v5 (Email+Google), sign up/in modals, pure JWT sessions (no DB adapter for OAuth) | Email verification, password reset |
| Session Persistence | **Working** (needs DB) | Auto-save, session list sidebar, load/delete/new, combined mobile drawer (sessions + nav), anonymous→auth bridge | — |
| Jewish Calendar | **Working** | Hebcal integration (parasha, learning, zmanim, holidays, dates), IP geolocation, Israel/Diaspora detection | User-selectable location override, persistent location preferences |
| Torah Search | **Working** | Sefaria API search with filters, copy button | Local vector search (pgvector) |
| Q&A Cache | **Working** (needs DB) | Save/retrieve by exact match | Semantic similarity matching |
| Public Q&A Pages | **Working** | `/answers` browse, `/answers/[slug]` with ISR + JSON-LD QAPage, category filters, related questions, ReactMarkdown, AEO-optimized answer structure (direct answer + key takeaways first) | — |
| Topic Pages | **Working** | `/topics` index, `/topics/[slug]` per-category, CollectionPage JSON-LD, ISR | — |
| Admin Review Queue | **Working** | AI scoring, rendered preview, edit/save/approve/reject, regenerate answer (re-runs RAG pipeline), image generation with preview | Bulk actions |
| AI Image Generation | **Working** | DALL-E gpt-image-1 (minimal watercolor style), Sharp compression, Cloudflare R2 storage, admin preview + regenerate | — |
| Contact Form | **Working** | Zod validation, Resend email | — |
| Rate Limiting | **Working** (needs Redis) | Per-IP sliding windows (ioredis sorted sets) | Per-user limits |
| SEO/AEO | **Working** | OpenGraph images with dimensions + fallback, fb:app_id, Apple icon, PWA manifest, JSON-LD (QAPage with upvoteCount/url/text, BreadcrumbList on all Q&A + topic pages, CollectionPage, Organization, WebSite), per-page metadata, robots.txt, sitemap.xml (dynamic, includes all published Q&A + topic pages), dynamic llms.txt route (ISR 1hr, lists all published Q&A), Schema.org citations, AEO-optimized answer structure | — |
| PWA | **Working** | `@ducanh2912/next-pwa` service worker, `/study` + `/search` page caching (NetworkFirst), API response caching, static asset caching (CacheFirst), install banner (60s delay, localStorage dismiss), footer install button (mobile), iOS share instructions, standalone mode starting at `/study` | Push notifications |
| Feedback | **Stub** | API validates input, logs to console | DB write, admin UI |
| Sanity CMS | **Not started** | Client + queries written | Sanity project, schemas, page integration |
| Marketplace | **Not started** | TypeScript interfaces only | Everything |
| Discourse Forum | **Not started** | Env var placeholders | SSO integration, API calls |
| Blog | **Not started** | Sanity query exists | Sanity content, blog pages |
| Events | **Not started** | Sanity query exists | Sanity content, events pages |
| App Directory | **Not started** | Sanity query exists | Sanity content, app listing pages |

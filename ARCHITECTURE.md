# AI Torah — Architecture Document

> Last updated: 2026-06-17

---

## 1. Project Purpose

AI Torah is a web platform at the intersection of artificial intelligence and Torah scholarship. It provides an **AI-powered study partner** (conversational Q&A with cited sources), **semantic Torah search** across the Sefaria library, and a **community hub** for scholars and developers to collaborate.

The target audience is Torah scholars, developers building Torah AI tools, and educators. The project is founded by Rabbi Haim Lubin and is in its early/MVP stage — the website and core AI chat are functional, while several planned features (marketplace, forums, authentication, CMS content) exist only as scaffolded placeholders.

---

## 2. Functionality

### 2.1 High-Level Overview

- **AI Study Partner** — Conversational Torah study powered by Claude (Anthropic). Users ask questions; the system retrieves relevant sources from Sefaria, then streams an AI-generated answer with citations.
- **Jewish Calendar (Hebcal)** — Real-time calendar data via Hebcal REST APIs: weekly parasha with full leyning, daily learning schedules (Daf Yomi, Mishna Yomi, etc.), Shabbat/candle-lighting times, halachic zmanim, upcoming holidays, and Hebrew↔Gregorian date conversion. IP-based geolocation detects Israel vs. Diaspora for parasha/schedule differences.
- **Torah Search** — Full-text search across the Sefaria library (Tanakh, Mishnah, Gemara, Rishonim, Acharonim) via Sefaria's ElasticSearch API. Supports category filtering.
- **Q&A Cache** — Previously answered questions are cached in PostgreSQL. Identical questions return cached answers instantly.
- **Contact Form** — Collects name, email, phone, interests, and message. Sends notification email via Resend.
- **Feedback Collection** — Accepts RLHF-style feedback (rating + correction) per chat message. Currently logs to console only (DB write is a TODO).
- **Community Page** — Static page directing users to the Discord server.
- **Health Check** — Simple `/api/health` endpoint for deployment monitoring.
- **SEO** — Auto-generated `robots.txt`, `sitemap.xml`, and `llms.txt`.

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
    │                ┌──────────┐                            │
    │                │ Upstash  │                            │
    │                │ Redis    │                            │
    │                │(rate     │                            │
    │                │ limit)   │                            │
    │                └──────────┘                            │
    └────────────────────────────────────────────────────────┘
```

### 2.2 Feature Deep-Dives

#### 2.2.1 AI Study Partner (Chat)

**Purpose**: The primary feature. Allows users to ask Torah questions and receive cited, sourced answers in a conversational chat interface.

**How it works**:
1. User types a question in the chat UI (`components/study/ChatInterface.tsx`) or the hero input on the home page (`components/home/HeroChat.tsx`).
2. If from the home page, the user is redirected to `/study?q=<encoded question>`.
3. `ChatInterface` sends `POST /api/chat` with the full message history.
4. **Rate limiting**: `lib/ratelimit.ts` checks per-IP limits via Upstash Redis (10/min, 50/day). If Redis is not configured, rate limiting is skipped.
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
- `lib/ai/prompts.ts` — System prompt builder (now accepts optional `calendarContext` parameter)
- `lib/db/qa.ts` — Q&A pair CRUD (save, find similar, get by slug, list recent)
- `lib/db/index.ts` — Drizzle/pg connection pool
- `lib/db/schema.ts` — `qa_pairs` table definition
- `lib/ratelimit.ts` — Upstash Redis rate limiting
- `components/study/ChatInterface.tsx` — Chat UI component
- `components/home/HeroChat.tsx` — Home page chat input

**Dependencies**: Anthropic API (Claude Haiku + Sonnet), Sefaria API, Hebcal API (hebcal.com, no auth), ip-api.com (geolocation, no auth), optionally PostgreSQL + Upstash Redis.

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
1. Uses Upstash Redis with two sliding windows: 10 requests/minute and 50 requests/day per IP.
2. If Redis env vars are missing, rate limiting is silently disabled.
3. Returns `429` responses with `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers.

**Files involved**:
- `lib/ratelimit.ts` — Rate limit logic

**Dependencies**: Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

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
│   │   ├── layout.tsx                # Uses AppShell (sidebar layout)
│   │   ├── search/page.tsx           # Torah Search page
│   │   └── study/page.tsx            # AI Study Partner page
│   ├── (marketing)/                  # Marketing-section layout (navbar + content)
│   │   ├── layout.tsx                # Uses Navbar
│   │   ├── page.tsx                  # Home page (hero, features, CTA)
│   │   ├── community/page.tsx        # Community/Discord page
│   │   └── contact/                  # Contact form
│   │       ├── layout.tsx            # Metadata-only layout
│   │       └── page.tsx              # Contact form UI (client component)
│   ├── api/                          # API routes
│   │   ├── answers/route.ts          # GET — cached Q&A pairs
│   │   ├── chat/route.ts             # POST — RAG chat (streaming)
│   │   ├── contact/route.ts          # POST — contact form (Resend email)
│   │   ├── feedback/route.ts         # POST — RLHF feedback (stub)
│   │   ├── health/route.ts           # GET — health check
│   │   └── search/route.ts           # GET — Sefaria full-text search
│   ├── layout.tsx                    # Root layout (fonts, GTM, Footer)
│   ├── globals.css                   # CSS variables, Tailwind directives, Hebrew class
│   ├── robots.ts                     # robots.txt generation
│   └── sitemap.ts                    # sitemap.xml generation
├── components/
│   ├── home/
│   │   └── HeroChat.tsx              # Home page chat input → redirects to /study
│   ├── layout/
│   │   ├── AppPageHeader.tsx         # Header bar for app pages (title + mobile menu)
│   │   ├── AppShell.tsx              # Full-height sidebar + content container
│   │   ├── Footer.tsx                # Site-wide footer with links and social icons
│   │   ├── MobileMenu.tsx            # Hamburger button + slide-out drawer
│   │   ├── Navbar.tsx                # Top nav for marketing pages
│   │   └── Sidebar.tsx               # Left sidebar for app pages (Study, Search, etc.)
│   ├── search/
│   │   └── SearchInterface.tsx       # Search UI with filters and result cards
│   ├── study/
│   │   └── ChatInterface.tsx         # Chat UI with message bubbles, source panel, hints
│   └── ui/
│       ├── BuildingBanner.tsx        # "We're building something new" CTA banner
│       └── LogoMark.tsx              # Logo image component (dark/light variants)
├── lib/
│   ├── ai/
│   │   └── prompts.ts               # System prompt builder for study partner
│   ├── db/
│   │   ├── index.ts                  # Drizzle + pg Pool singleton
│   │   ├── qa.ts                     # Q&A pair CRUD operations
│   │   └── schema.ts                 # Drizzle table defs + legacy TS interfaces
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
│   └── ratelimit.ts                  # Upstash Redis rate limiting
├── drizzle/
│   ├── 0000_fuzzy_tombstone.sql      # Initial migration: qa_pairs table
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
│   ├── llms.txt                      # LLM-readable site description
│   ├── logo.png, logo-light.png, logo-transparent.png
│   ├── powered-by-sefaria.png
│   ├── torah-scroll-bg.png
│   ├── haim.jpeg
│   └── fonts/                        # (empty — fonts loaded via next/font/google)
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
├── next.config.mjs                   # Next.js config (standalone output, Sanity images)
├── tailwind.config.ts                # Tailwind config (custom theme)
├── tsconfig.json                     # TypeScript config
├── postcss.config.mjs                # PostCSS config
└── package.json                      # Dependencies and scripts
```

⚠️ **Oddly-named directories**: `resources}`, `sanity}}`, `settings}` exist at the project root with trailing curly braces. These are empty and appear to be accidental directory creation artifacts. Safe to delete.

### 3.2 Shared / Core Components

| Component / Module | File | Purpose | Imported By |
|---|---|---|---|
| `LogoMark` | `components/ui/LogoMark.tsx` | Renders the AI Torah logo (dark/light variants) | `Navbar`, `Sidebar`, `MobileMenu`, `Footer` |
| `BuildingBanner` | `components/ui/BuildingBanner.tsx` | CTA banner linking to `/contact` | Not currently imported (available for use) |
| `AppShell` | `components/layout/AppShell.tsx` | Full-height `Sidebar + content` container | `app/(app)/layout.tsx` |
| `AppPageHeader` | `components/layout/AppPageHeader.tsx` | Page header with title + mobile menu | `study/page.tsx`, `search/page.tsx` |
| `Navbar` | `components/layout/Navbar.tsx` | Top navigation for marketing pages | `app/(marketing)/layout.tsx` |
| `Footer` | `components/layout/Footer.tsx` | Site-wide footer with social links and "Powered by Hebcal" attribution | `app/layout.tsx` (root) |
| `Sidebar` | `components/layout/Sidebar.tsx` | Left sidebar navigation for app pages | `AppShell` |
| `MobileMenu` | `components/layout/MobileMenu.tsx` | Hamburger button + drawer overlay | `Navbar`, `AppPageHeader` |
| `getDb()` | `lib/db/index.ts` | Returns Drizzle ORM instance with pg Pool | `lib/db/qa.ts` |
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
| PostgreSQL | Database | `DATABASE_URL` env var | Optional — app works without it (Q&A caching disabled) |
| Sefaria API | External REST API | `https://www.sefaria.org` (no auth required) | Active — primary Torah text source |
| Hebcal API | External REST API | `https://www.hebcal.com` (no auth required) | Active — Jewish calendar data (parasha, zmanim, holidays, dates) |
| ip-api.com | External REST API | `http://ip-api.com` (no auth, free tier) | Active — IP geolocation for Israel/Diaspora detection |
| Anthropic Claude | External API | `ANTHROPIC_API_KEY` env var | Active — powers chat and intent classification |
| Upstash Redis | Managed Redis | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional — rate limiting disabled without it |
| Resend | Email API | `RESEND_API_KEY` env var | Active — contact form emails |
| Sanity CMS | Headless CMS | `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` | Configured but unused — no content or pages consume it |

**Database schema** (single table — `drizzle/0000_fuzzy_tombstone.sql`):

```
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
├── created_at          timestamptz default now()
│
├── INDEX idx_qa_slug    (slug)
└── INDEX idx_qa_created (created_at)
```

**Legacy TypeScript interfaces** in `lib/db/schema.ts` (lines 23-92) define types for future tables: `User`, `TorahText`, `StudySession`, `MarketplaceListing`, `Order`, `RlhfFeedback`. These are **not backed by database tables** — they are aspirational type definitions only.

**Sefaria API caching**: `lib/sefaria/client.ts` implements an in-memory LRU cache (max 500 entries) with configurable TTL. Text lookups cache for 24 hours; search results cache for 1 hour. Cache is per-process and resets on deploy.

**Hebcal API caching**: `lib/hebcal/client.ts` uses the same in-memory LRU cache pattern (max 500 entries). Calendar/Shabbat/Zmanim responses cache for 6 hours; date conversions cache for 24 hours. Geolocation results (`lib/hebcal/geo.ts`) are cached separately for 24 hours (max 1000 entries). All caches are per-process and reset on deploy.

### 3.4 UI Structure

#### Screens / Pages

| Route | Page File | Layout | Description |
|---|---|---|---|
| `/` | `app/(marketing)/page.tsx` | Marketing (Navbar) | Home page: hero with chat input, feature cards, how-it-works, CTA |
| `/study` | `app/(app)/study/page.tsx` | App (Sidebar) | AI Study Partner: full chat interface with source panel |
| `/search` | `app/(app)/search/page.tsx` | App (Sidebar) | Torah Search: search bar, filters, result cards |
| `/community` | `app/(marketing)/community/page.tsx` | Marketing (Navbar) | Community: Discord info, channels, audience types |
| `/contact` | `app/(marketing)/contact/page.tsx` | Marketing (Navbar) | Contact form: name, email, interests, message |

#### Key User Flows

**Flow 1: Ask a Torah question (from home page)**
1. User lands on `/` → sees hero section with chat input (`HeroChat`).
2. Types question → presses Enter or clicks send.
3. Redirected to `/study?q=<encoded question>`.
4. `ChatInterface` reads `q` param, auto-sends the message.
5. Answer streams in with cited sources. User can expand sources panel to view Hebrew/English text and "View on Sefaria" links.
6. User can continue the conversation with follow-up questions.

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
├── Font CSS variables (body class)
├── {children}                        ← route group layout injected here
└── Footer (components/layout/Footer.tsx)

Marketing Layout (app/(marketing)/layout.tsx)
├── Navbar (components/layout/Navbar.tsx)
│   ├── Logo + "AI Torah" link
│   ├── Nav links: Study, Search, Community, Contact
│   ├── "Powered by Sefaria" badge
│   └── Mobile: hamburger → MobileMenuDrawer
└── <main>{children}</main>

App Layout (app/(app)/layout.tsx)
└── AppShell (components/layout/AppShell.tsx)
    ├── Sidebar (components/layout/Sidebar.tsx)    ← hidden on mobile
    │   ├── Logo + "AI Torah" link
    │   ├── Nav: Study Partner, Torah Search, Community, Contact
    │   └── "Powered by Sefaria" badge
    └── Content area
        └── {children}                             ← individual page
            └── AppPageHeader (title + mobile menu)
```

#### Navigation

- **Marketing pages** (`/`, `/community`, `/contact`): Top `Navbar` with horizontal links. Mobile: hamburger opens `MobileMenuDrawer` (left slide-out).
- **App pages** (`/study`, `/search`): Left `Sidebar` (220px, hidden on mobile). Mobile: `AppPageHeader` includes a hamburger that opens the same `MobileMenuDrawer`.
- Nav items are defined as constants in `Sidebar.tsx` (line 7), `MobileMenu.tsx` (line 6), and `Navbar.tsx` (line 22).
- No auth guards or route protection — all pages are publicly accessible.

#### State Management

No global state management library. All state is local to components via React `useState`:
- `ChatInterface`: messages array, input text, streaming state, open source panels
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

### 4.3 Environment Variables

| Variable | Required | Used In | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | `app/api/chat/route.ts:8` | Anthropic API authentication |
| `DATABASE_URL` | No | `lib/db/index.ts:9` | PostgreSQL connection string |
| `RESEND_API_KEY` | Yes (for contact) | `app/api/contact/route.ts:5` | Resend email API key |
| `CONTACT_EMAIL` | Yes (for contact) | `app/api/contact/route.ts:26` | Recipient of contact form emails |
| `UPSTASH_REDIS_REST_URL` | No | `lib/ratelimit.ts:5` | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | `lib/ratelimit.ts:5` | Upstash Redis auth token |
| `NEXTAUTH_SECRET` | No (unused) | — | Reserved for NextAuth.js |
| `NEXTAUTH_URL` | No | `app/robots.ts:3`, `app/sitemap.ts:3` | Base URL for SEO files (defaults to `https://aitorah.com`) |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | No (unused) | `lib/sanity/client.ts:4` | Sanity project ID |
| `NEXT_PUBLIC_SANITY_DATASET` | No (unused) | `lib/sanity/client.ts:5` | Sanity dataset (default: "production") |
| `SANITY_API_TOKEN` | No (unused) | `lib/sanity/client.ts:12` | Sanity write token |
| `GOOGLE_CLIENT_ID` | No (unused) | — | Reserved for Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No (unused) | — | Reserved for Google OAuth |
| `DISCORD_CLIENT_ID` | No (unused) | — | Reserved for Discord OAuth |
| `DISCORD_CLIENT_SECRET` | No (unused) | — | Reserved for Discord OAuth |
| `OPENAI_API_KEY` | No (unused) | — | Reserved for embeddings |
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
| `navItems` | Array | `components/layout/Sidebar.tsx:7-12` | Sidebar navigation items: Study Partner, Torah Search, Community, Contact |
| `menuItems` | Array | `components/layout/MobileMenu.tsx:6-11` | Mobile menu items: Study, Search, Community, Contact |

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
| `npm run build` | Production build (standalone output) |
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

---

## 6. Deployment

### Hosting

- **Platform**: [Railway](https://railway.app)
- **Builder**: Nixpacks (auto-detected Next.js)
- **Output mode**: Standalone (`next.config.mjs` → `output: 'standalone'`)

### Branch → Environment Mapping

| Branch | Environment | URL |
|---|---|---|
| `main` | Production | `aitorah.com` (custom domain) / Railway-provided URL |

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
| `NEXTAUTH_URL` | Set to `https://aitorah.com` |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |

### Optional Environment Variables (Production)

| Variable | Feature it enables |
|---|---|
| `DATABASE_URL` | Q&A caching, answers API |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` | CMS content (not yet used) |

### Deployment Steps

```bash
# Push to main triggers auto-deploy
git push origin main

# Verify
curl https://aitorah.com/api/health
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
| Home page | **Working** | Full marketing page with hero chat | — |
| AI Study Partner | **Working** | RAG pipeline, streaming chat, source panel | Session persistence, user accounts |
| Jewish Calendar | **Working** | Hebcal integration (parasha, learning, zmanim, holidays, dates), IP geolocation, Israel/Diaspora detection | User-selectable location override, persistent location preferences |
| Torah Search | **Working** | Sefaria API search with filters | Local vector search (pgvector) |
| Q&A Cache | **Working** (needs DB) | Save/retrieve by exact match | Semantic similarity matching |
| Contact Form | **Working** | Zod validation, Resend email | — |
| Rate Limiting | **Working** (needs Redis) | Per-IP sliding windows | Per-user limits |
| Feedback | **Stub** | API validates input, logs to console | DB write, admin UI |
| Auth (NextAuth) | **Not started** | `next-auth` in dependencies | Provider config, session handling, protected routes |
| Sanity CMS | **Not started** | Client + queries written | Sanity project, schemas, page integration |
| Marketplace | **Not started** | TypeScript interfaces only | Everything |
| Discourse Forum | **Not started** | Env var placeholders | SSO integration, API calls |
| Blog | **Not started** | Sanity query exists | Sanity content, blog pages |
| Events | **Not started** | Sanity query exists | Sanity content, events pages |
| App Directory | **Not started** | Sanity query exists | Sanity content, app listing pages |

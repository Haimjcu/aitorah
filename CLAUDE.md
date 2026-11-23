# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Active Redesign: Agent Platform (started 2026-11-23)

The AI layer is being rebuilt. The current single-prompt pipeline (described under "Architecture" below) is the **legacy** system. It stays in production until the new system passes evals. The research plan is in `docs/11-agent-redesign-research-plan.md`; the build plan (awaiting owner approval; do not build before it is approved) is in `docs/12-agent-platform-build-plan.md`. Read it before touching anything under `lib/ai/`, `lib/rag/`, or `app/api/chat/`.

**Target system (what we are building toward):**
- **Agent harness**: a tool-using agent loop, not one prompt. Retrieval (Sefaria, Hebcal) becomes tools the agent calls.
- **Topic-specialist agents**: a router classifies the question into a Torah domain (halacha, chassidut, gemara, tanakh/parsha, kabbalah, machshava, mussar, tefillah, minhag, calendar, …). A specialist agent then answers with that domain's skills. The final taxonomy comes from analyzing real chats (plan Phase 1), not from guessing.
- **Skills**: versioned, per-domain instruction packs (how to search texts for this domain, citation conventions, which sources are authoritative, pitfalls). They are stored as data so they can be edited and improved without a deploy.
- **Evals**: golden question sets per domain, built from real chats. Every prompt or skill change must pass evals before it ships. No eval, no change.
- **Memory**: per-user and per-project memory, plus agent-level learnings per domain.
- **Self-learning loop**: user corrections and eval failures produce *proposed* skill/prompt changes. Low-risk changes auto-apply after passing evals. Halachic or doctrinal changes need admin (owner) approval.
- **Projects**: logged-in users keep projects with their own memory, chat history, and uploaded files and images used as context.
- **Languages**: English, Hebrew, French, Spanish, Russian, Yiddish, Portuguese, German (UI and answers). Hebrew and Yiddish are RTL. Any other language needs owner approval before it is added.
- **Nusach/community**: ask once and store it in the user profile; lead with that practice and label the others. If it is not set, present the main practices, each labeled.
- **Corrections (option D)**: low-risk corrections auto-apply after evals. High-risk ones from trusted reviewers are pre-reviewed by them. Halachic changes always need final owner approval.
- **Hosting**: the agent loop runs on our own Railway server (Messages API + tools), not Managed Agents.

**Redesign ground rules:**
- **Data sources do not change**: Sefaria and Hebcal stay the source of texts and calendar. Do not add other text corpora without approval.
- **Model IDs live in one config module.** Never hard-code a model string in a route. Use current model IDs (the Claude 5 family); see the plan for which model goes on which route.
- **Halachic safety**: never auto-apply a change that alters a halachic ruling, a minority/majority labeling, or a source's attribution. Those always go to the approval queue.
- **User chat data is private.** Analysis exports go to the scratchpad or a git-ignored folder, stripped of user IDs and emails. Never commit raw chats.
- Keep the legacy `/api/chat` working until the new endpoint replaces it behind a flag.

## Agent platform (built on `harness`, not yet launched)

- **Flow:** `/api/agent` (SSE) → `lib/agent/router.ts` (Haiku 5.5 picks 1–2 of 5 domains + shared skills + language) → `lib/agent/skills.ts` loads active skill versions (DB `skill_versions`, fallback `skills/*.md`) → `lib/agent/run.ts` tool loop on Sonnet 5.5 (`lib/agent/tools.ts`: Sefaria/Hebcal tools; `remember`/`update_profile` for signed-in users; `read_project_file` in projects) → citation check → `answer_logs`.
- **Kill switch:** `AGENT_ENABLED=true` turns the agent on. When it is off, `/api/agent` returns 404 and `ChatInterface` falls back to legacy `/api/chat`.
- **Evals:** `npm run eval -- --target legacy|agent [--domain d] [--split train|test] [--skill slug@version]`. Cases are in `evals/cases.jsonl` (255, 7 languages) plus approved correction cases from the DB. Opus 5.5 is the judge. Reports go to `evals/runs/`. Tune on `--split train` and report on `--split test`. No prompt or skill change ships without an eval run.
- **Skills:** edit in `/admin/skills` (versioned, rollback = activate an old version) or in `skills/*.md` + `scripts/seed-skills.ts`. The halacha skill needs owner + rabbi approval.
- **Corrections → learning loop:** users submit corrections from the chat. `lib/corrections.ts` triages them (low / high / halachic; injections are auto-rejected). `npm run learning-loop` makes Opus propose a skill revision, then evals the draft against the active version. Only low-risk changes with no regression auto-apply; everything else waits in `/admin/corrections`.
- **Projects / memory / files:** `lib/user-data.ts`, `lib/files.ts` (private R2 under `user-files/`, Anthropic Files API, Sonnet transcription). Limits are in `lib/limits.ts` (all unlimited).
- **i18n:** only the app section (`app/(app)/layout.tsx`). Strings are in `lib/i18n/messages/en.ts`; other locales are generated by `scripts/translate-ui.ts` and need native review. Use logical Tailwind classes (`ms-`, `me-`, `text-start`) for RTL. Public SEO pages are not localized.
- **Nusach values:** `ashkenazi | sephardi | chassidic_sefard | chabad | teimani | other`. "Nusach Sefard" is Chassidic Ashkenazi, not Sephardi.

## Project Overview

AI Torah is a Next.js 16 web app that provides an AI-powered Torah study partner, semantic Torah search, and SEO-optimized Q&A pages. The core feature is a RAG pipeline: user questions are classified by intent (Haiku), relevant sources are retrieved from Sefaria APIs, and answers are generated by Claude Sonnet with citations streamed to the client. Jewish calendar data (parasha, zmanim, holidays) is integrated via Hebcal REST APIs with IP-based geolocation for Israel/Diaspora detection.

Production URL: `https://aitorah.ai` — deployed on Railway with auto-deploy on push to `main`.

## Commands

```bash
npm run dev          # Dev server on :3000
npm run build        # Production build (standalone output)
npm run start        # Start production server
npm run lint         # ESLint

# Database migrations (requires DATABASE_URL)
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit push       # Push schema to database
```

**Local development (agent platform work happens on the `harness` branch):** the local `.env` keys are stale. Use `scripts/dev-local.sh <command>`. It injects the `aitorah` service's secrets from Railway in memory (never written to disk) and points `DATABASE_URL` at a local Docker Postgres (`aitorah-pg`, port 5433, setup command in the script). It disables Redis.

```bash
scripts/dev-local.sh npm run dev
scripts/dev-local.sh npx drizzle-kit migrate   # apply drizzle/*.sql to the local DB
```

There is no unit test suite. Quality is measured by the eval harness (milestone M1 of the build plan).

## Architecture

### App Router Layout Groups

- `app/(marketing)/` — Public pages (home, community, contact) using `Navbar` layout
- `app/(app)/` — App pages (study, search, admin) using `AppShell` with left `Sidebar`
- `app/answers/` and `app/topics/` — SEO pages with ISR, JSON-LD structured data

### RAG Pipeline (`app/api/chat/route.ts`)

The chat endpoint orchestrates this sequence:
1. **Rate limit** — ioredis sliding window per IP (`lib/ratelimit.ts`)
2. **Cache check** — Exact normalized match in `qa_pairs` table (`lib/db/qa.ts`)
3. **Intent classification** — Haiku 5.5 classifies into 14 intent types including 7 `calendar_*` types (`lib/rag/intent.ts`)
4. **Calendar resolution** (if calendar intent) — IP geolocation (`lib/hebcal/geo.ts`) → Hebcal API (`lib/hebcal/resolver.ts`) → context block injected into system prompt
5. **RAG retrieval** — Parallel multi-strategy Sefaria retrieval: refs, topics, search, commentary, autocomplete (`lib/rag/retrieval.ts`). Top 8 sources selected.
6. **Answer generation** — Claude Sonnet 5.5 streams answer (model settings: `lib/ai/models.ts`) with `<!--SOURCES:...-->` JSON prefix (`lib/ai/prompts.ts`)
7. **Cache write** — Q&A pair saved to PostgreSQL after streaming completes

### Data Layer

- **ORM**: Drizzle ORM with `pg` driver. Schema in `lib/db/schema.ts`, migrations in `drizzle/`.
- **Tables**: `users`, `accounts`, `auth_sessions`, `verification_tokens`, `study_sessions`, `qa_pairs`
- **Auth**: NextAuth v5 with pure JWT strategy (no database adapter for sessions). Google OAuth + email/password. Google users linked to DB users by email in JWT callback.
- **Caching**: In-memory LRU caches for Sefaria (24h text, 1h search), Hebcal (6h calendar, 24h dates), and geolocation (24h). Redis (ioredis) for rate limiting and Q&A page caching. All per-process caches reset on deploy.

### External Services

| Service | Usage | Auth |
|---|---|---|
| Anthropic Claude | Chat (Sonnet) + intent classification (Haiku) | `ANTHROPIC_API_KEY` |
| Sefaria API | Torah text retrieval and search | None (public) |
| Hebcal API | Jewish calendar data (parasha, zmanim, holidays, dates) | None (public, ~90 req/10s limit) |
| ip-api.com | IP geolocation for Israel/Diaspora detection | None (HTTP only on free tier) |
| OpenAI DALL-E | Featured image generation for Q&A pages | `OPENAI_API_KEY` |
| Cloudflare R2 | Image storage | `R2_*` env vars |
| Resend | Contact form emails | `RESEND_API_KEY` |
| Redis | Rate limiting + page caching | `REDIS_URL` |
| PostgreSQL | All persistent data | `DATABASE_URL` |

### Graceful Degradation

PostgreSQL, Redis, Hebcal, and geolocation are all optional. Without `DATABASE_URL`: no Q&A caching, no auth, no sessions. Without `REDIS_URL`: no rate limiting, no page caching. Without Hebcal/geo: chat continues without calendar context.

### Path Aliases

`@/*` maps to project root (tsconfig paths). Example: `import { retrieve } from '@/lib/rag/retrieval'`.

### Key Patterns

- **Streaming responses**: Chat API returns a `ReadableStream` with a `<!--SOURCES:...-->` JSON prefix followed by markdown text. The client (`components/study/ChatInterface.tsx`) parses this prefix to extract source metadata.
- **ISR**: Public Q&A pages use `revalidate` (1hr for individual pages, 30min for browse/topic listings).
- **Admin access**: Controlled by `ADMIN_EMAIL` env var matching the authenticated user's email. No role-based system.
- **Image generation**: DALL-E → Sharp compression (1200×800 WebP) → R2 upload. Minimal prompt: question + category, watercolor style, no people/text.
- **AEO-optimized answers**: System prompt enforces structure — direct 2-3 sentence answer first, then Key Takeaways, then detailed answer. No trailing summary.

## Styling

Tailwind CSS 3 with `@tailwindcss/typography` plugin. Custom theme colors defined in both `tailwind.config.ts` and as CSS custom properties in `app/globals.css`. Font families: Inter (sans), Playfair Display (serif), Noto Sans Hebrew (hebrew), loaded via `next/font/google`. Hebrew text uses `.hebrew` class (RTL, navy color).

## Deployment

Railway with Nixpacks. `railway.json` copies static assets into standalone build before starting. Migrations are manual (`npx drizzle-kit push` with production `DATABASE_URL`). Health check at `/api/health`.

- Railway project: **`ai-torah`** (services: `aitorah`, `Postgres`, `Redis`). The same Railway account also hosts `justconnectus` and `themoshavecountryfair`, so always pass `--project ai-torah` / check `railway status` before running any Railway command.
- **Database access from a laptop:** the Postgres service currently has **no public TCP proxy**, so the `DATABASE_URL` in local `.env` (`*.proxy.rlwy.net`) is stale and connections reset. To reach production data, enable a TCP proxy on the Postgres service, or run read-only scripts inside Railway (`railway ssh` into `aitorah`).
- Where chats live: `study_sessions` holds full multi-turn chats **for logged-in users only** (messages stored as a JSON string). `qa_pairs` holds every first-turn question and answer, including anonymous ones. Corpus analysis must use both tables.

## Important Notes

- `Sefaria-Project-master/` and `hebcal-es6-main/` are reference clones excluded from TypeScript compilation — do not modify or import from them.
- `lib/db/schema.ts` contains legacy TypeScript interfaces (`TorahText`, `MarketplaceListing`, etc.) that are not backed by database tables.
- Sanity CMS client and queries exist (`lib/sanity/`) but nothing consumes them — no Sanity project is active.
- `.npmrc` has `legacy-peer-deps=true`.
- The feedback API (`app/api/feedback/route.ts`) is a stub — validates input but only logs to console.

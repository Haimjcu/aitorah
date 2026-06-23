# 09 — Deploying the Sefaria RAG to Railway

This guide covers deploying the Phase 1 RAG system (Sefaria API integration) to the existing Railway project. The RAG uses the Sefaria public API (no auth needed), the Anthropic API, and PostgreSQL for Q&A pair caching.

---

## Prerequisites

- Railway project `ai-torah` already running (see `04-railway-deployment-guide.md`)
- `ANTHROPIC_API_KEY` set in Railway environment variables
- Git repo pushed to GitHub and connected to Railway

---

## 1. What Changed (RAG Files)

These files were added or modified and need to be deployed:

### New files
| File | Purpose |
|---|---|
| `lib/sefaria/types.ts` | TypeScript types for Sefaria API responses |
| `lib/sefaria/client.ts` | Sefaria API client with in-memory caching |
| `lib/rag/intent.ts` | Intent classification using Claude Haiku |
| `lib/rag/retrieval.ts` | Multi-strategy retrieval pipeline |
| `lib/db/index.ts` | Database connection singleton (Drizzle + pg) |
| `lib/db/schema.ts` | Drizzle schema — `qa_pairs` table |
| `lib/db/qa.ts` | Q&A CRUD operations (save, find, list) |
| `app/api/answers/route.ts` | SEO Q&A API endpoint |
| `drizzle.config.ts` | Drizzle Kit configuration |
| `drizzle/0000_fuzzy_tombstone.sql` | Migration: create `qa_pairs` table + indexes |

### Modified files
| File | Change |
|---|---|
| `app/api/chat/route.ts` | Runs RAG pipeline, caches Q&A pairs to database |
| `app/api/search/route.ts` | Replaced mock data with live Sefaria ES search |
| `components/study/ChatInterface.tsx` | Parses streamed sources, shows Sefaria links |
| `components/search/SearchInterface.tsx` | Real search with loading states |
| `lib/ai/prompts.ts` | Enhanced system prompt for source-grounded answers |
| `tsconfig.json` | Excluded `Sefaria-Project-master` from compilation |
| `app/(app)/search/page.tsx` | Updated subtitle text |

---

## 2. Environment Variables

### Required (already set)
```
ANTHROPIC_API_KEY=sk-ant-...    # Used by both Claude Sonnet (generation) and Claude Haiku (intent classification)
DATABASE_URL=${{aitorah-db...}} # PostgreSQL for Q&A pair storage
```

The Sefaria API is public and requires no authentication.

**Note**: The RAG works without `DATABASE_URL` — it just won't cache Q&A pairs. If `DATABASE_URL` is not set, Q&A storage is silently skipped.

### Optional (for future phases)
```
OPENAI_API_KEY=sk-...           # Phase 2: text-embedding-3-small for pgvector embeddings
REDIS_URL=${{aitorah-redis...}} # Phase 2: response caching (currently uses in-memory cache)
```

---

## 3. Deploy Steps

### 3.1 Verify the build locally
```bash
npm run build
```

Expected output: all routes compile, no TypeScript errors. The `Sefaria-Project-master` directory is excluded via `tsconfig.json` — it will not affect the build.

### 3.2 Commit and push
```bash
git add lib/sefaria/ lib/rag/ app/api/chat/route.ts app/api/search/route.ts \
  components/study/ChatInterface.tsx components/search/SearchInterface.tsx \
  lib/ai/prompts.ts tsconfig.json app/\(app\)/search/page.tsx

git commit -m "Add Phase 1 RAG: Sefaria API integration with multi-strategy retrieval"
git push origin main
```

Railway auto-deploys on push to `main`. Monitor the deploy in the Railway dashboard.

### 3.3 Create PostgreSQL on Railway

1. Open the `ai-torah` project in the Railway dashboard
2. Click **+ New** → **Database** → **Add PostgreSQL**
3. Railway provisions the database and exposes a `DATABASE_URL` variable
4. Link it to the web service: go to your `aitorah-web` service → **Variables** → **Add Reference Variable** → select `DATABASE_URL` from the PostgreSQL service
5. Railway will redeploy the web service with the new variable

Alternatively, from the CLI:
```bash
railway add --plugin postgresql
```

### 3.4 Run database migration

The `qa_pairs` table must exist before the app can cache Q&A pairs.

**Option A — Manual SQL via Railway's Query tab (simplest)**

1. Open the PostgreSQL service in Railway dashboard
2. Go to the **Data** tab → **Query**
3. Paste and run the contents of `drizzle/0000_fuzzy_tombstone.sql`:

**Option B — Drizzle Kit from local machine**

Copy `DATABASE_URL` from Railway dashboard (PostgreSQL service → **Connect** tab → **Public URL**), then run:
```bash
DATABASE_URL="postgresql://..." npx drizzle-kit migrate
```

This reads the migration files from `drizzle/` and applies them in order.

```sql
CREATE TABLE "qa_pairs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question" text NOT NULL,
  "question_normalized" text NOT NULL,
  "answer_markdown" text NOT NULL,
  "source_refs" text[] NOT NULL,
  "topics" text[],
  "categories" text[],
  "language" text DEFAULT 'en',
  "view_count" integer DEFAULT 0,
  "slug" text,
  "similarity" real,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "qa_pairs_slug_unique" UNIQUE("slug")
);
CREATE INDEX "idx_qa_slug" ON "qa_pairs" USING btree ("slug");
CREATE INDEX "idx_qa_created" ON "qa_pairs" USING btree ("created_at");
```

**Note**: If `DATABASE_URL` is not set or the table doesn't exist, the app still works — it just skips Q&A caching silently.

### 3.5 Verify deployment
After Railway deploys (typically 2-3 minutes):

**Test search:**
```bash
curl 'https://aitorah.ai/api/search?q=shabbat&limit=3'
```
Expected: JSON with real Sefaria results (refs, Hebrew text, English translations).

**Test chat:**
```bash
curl -X POST 'https://aitorah.ai/api/chat' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What does Genesis 1:1 say?"}]}'
```
Expected: Stream with `<!--SOURCES:[...]-->` prefix followed by Claude's response citing the retrieved sources.

**Test Q&A cache:**
```bash
curl 'https://aitorah.ai/api/answers'
```
Expected: `{"items":[]}` initially (no cached Q&A pairs yet). After a few chat queries, cached pairs will appear.

---

## 4. How the RAG Pipeline Works in Production

```
User Question
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. Intent Classification (Claude Haiku)                      │
│    - Classifies: text_lookup / topic / commentary / halachic │
│    - Extracts: refs, topics, search terms (EN + HE)          │
│    Cost: ~$0.0003 per query                                  │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Parallel Retrieval (Sefaria API — free, no auth)          │
│    ├─ Direct ref lookup: GET /api/v3/texts/{ref}             │
│    ├─ ES search (lemmatized + exact): POST /api/search/text  │
│    ├─ Topic lookup: GET /api/topics/{slug}?with_refs=1       │
│    ├─ Commentary links: GET /api/links/{ref}                 │
│    └─ Autocomplete fallback: GET /api/name/{name}            │
│    All run in parallel. Results cached in-memory (1-24h TTL) │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Deduplicate, Rank, Select top 8 sources                   │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Generation (Claude Sonnet — streaming)                    │
│    System prompt includes retrieved source passages           │
│    Cost: ~$0.01-0.03 per query                               │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
  Response streamed to client with sources as metadata
```

### Cost per query
| Component | Cost |
|---|---|
| Intent classification (Haiku) | ~$0.0003 |
| Sefaria API calls | Free |
| Response generation (Sonnet) | ~$0.01–0.03 |
| **Total per query** | **~$0.01–0.03** |

---

## 5. Caching Behavior


The RAG uses in-memory caching on the Railway instance. This means:

| Data | TTL | Notes |
|---|---|---|
| Sefaria text responses | 24 hours | Texts rarely change |
| Sefaria topic data | 24 hours | Topic ontology is stable |
| Sefaria link data | 24 hours | Link graph is stable |
| ES search results | 1 hour | Search index updates more frequently |
| Autocomplete results | 1 hour | — |
| Cache max size | 500 entries | LRU eviction when full |

**Important**: Cache resets on every Railway deploy. This is fine — the cache is a performance optimization, not a data store. First requests after deploy will be slightly slower as the cache warms up.

For Phase 2, move caching to Redis (`aitorah-redis` service) for persistence across deploys.

---

## 6. Monitoring

### Logs to watch
In Railway's log viewer for `aitorah-web`:

- `Chat error:` — RAG pipeline failure (usually Sefaria API timeout or Anthropic rate limit)
- `Search error:` — Sefaria ES search failure
- `Sefaria API error:` — specific Sefaria endpoint failure with status code

### Health check
The existing `/api/health` endpoint confirms the app is running. It does not test the Sefaria API connection (since it's external and stateless).

### Rate limits
- **Sefaria API**: No documented rate limit, but be respectful. The in-memory cache prevents repeated calls.
- **Anthropic API**: Check your plan limits at console.anthropic.com. Each chat query makes 2 API calls (1 Haiku for intent, 1 Sonnet for generation).

---

## 7. Troubleshooting

### "Search failed" or empty results
- Sefaria's API may be temporarily down. Check `https://www.sefaria.org` directly.
- The query may not match any texts. Try broader terms.
- Check Railway logs for the specific error.

### Chat returns no sources
- The intent classifier may not have extracted useful search terms. Check the Claude Haiku response in logs.
- Topic slugs may not match Sefaria's topic database. The pipeline falls back to autocomplete, but unusual terms may return nothing.
- Sefaria API calls may be timing out. Railway's default request timeout is 30s — the RAG pipeline needs to complete retrieval within this window.

### Slow responses (> 10s)
- Intent classification + parallel retrieval typically takes 1-3s.
- If Sefaria API is slow, the parallel calls will wait. The cache mitigates this after the first call.
- Claude Sonnet streaming starts as soon as retrieval completes — perceived latency is better than total latency.

### Build fails with Sefaria-Project-master errors
- `tsconfig.json` must include `"Sefaria-Project-master"` in the `exclude` array.
- Alternatively, add `Sefaria-Project-master/` to `.gitignore` so it's never pushed to Railway.

---

## 8. Next Steps (Phase 2 — after Phase 1 is live)

Phase 2 adds pgvector embeddings for semantic search. This requires:

1. **`OPENAI_API_KEY`** — for `text-embedding-3-small` embeddings
2. **PostgreSQL with pgvector** — already set up (`CREATE EXTENSION vector` on `aitorah-db`)
3. **Sefaria-Export data** — clone `github.com/Sefaria/Sefaria-Export` for bulk JSON
4. **Embedding ingestion script** — batch process texts through OpenAI embeddings API
5. **Hybrid retrieval** — combine vector search with the existing ES + topic pipeline

See `docs/07-rag-design.md` for the full Phase 2 design.

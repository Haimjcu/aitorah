# 07 — RAG Design: Study Partner & Torah Search

## Overview

This document describes the Retrieval-Augmented Generation (RAG) architecture for AI Torah's two AI-powered features:

1. **Study Partner** (`/study`) — conversational Torah study with cited sources
2. **Torah Search** (`/search`) — semantic search across Torah texts

Both features use the **Sefaria API** as the primary source of Torah texts and metadata. The design is split into two phases:

- **Phase 1**: Topic-based index + Sefaria API search (no vector DB)
- **Phase 2**: Add vector embeddings for true semantic search

### Competitive Advantage

Sefaria itself has **no production vector/semantic search** — their search is purely lexical (Elasticsearch). Their embedding experiments (ChromaDB, VoyageAI, OpenAI embeddings) remain in an experimental LLM repo and are not deployed. AI Torah's Phase 2 pgvector embeddings will provide semantic search capabilities that don't exist anywhere in the Sefaria ecosystem today.

Similarly, Sefaria's recommendation engine is purely graph-based (link co-occurrence + PageSheetRank), not embedding-based. Embedding-powered semantic recommendations are a differentiated feature.

---

## Sefaria API — Key Capabilities

### No Auth Required
The Sefaria API is open — no API keys or authentication needed. All endpoints are public.

### Core Endpoints We'll Use

| Endpoint | Purpose |
|---|---|
| `GET /api/v3/texts/{tref}` | Fetch text by reference (e.g., `Genesis 1:1`) |
| `GET /api/links/{tref}` | Get all connections for a text (commentaries, midrash, related) |
| `GET /api/link-summary/{tref}` | Summary of link categories and counts for a ref |
| `GET /api/related/{tref}` | All related content in one call (links, sheets, topics, media) |
| `POST /api/search/text/_search` | ElasticSearch proxy — full-text search across the library |
| `GET /api/topics/{slug}` | Topic metadata, linked texts, related topics |
| `GET /api/topics` | All topics (30,000+) |
| `GET /api/index` | Table of Contents — entire library organized by category |
| `GET /api/passages/{refs}` | Map refs to canonical passages (sugya for Talmud, parasha for Tanakh) |
| `GET /api/ref-topic-links/{tref}` | Topics linked to a given text ref |
| `GET /api/calendars` | Daily/weekly learning schedule |

### How Texts Are Organized

**References (Refs)**: Human-readable, machine-parseable identifiers like `Genesis 1:1`, `Berakhot 2a`, `Rashi on Genesis 1:2:1`. This is the atomic unit of the system.

**Categories**: Hierarchical tree — `Tanakh > Torah > Genesis`. Top-level categories: Tanakh, Mishnah, Talmud, Midrash, Halakhah, Kabbalah, Liturgy, Philosophy, etc.

**Index**: Each book has an Index (schema/structure) and one or more Versions (editions/translations).

**Links**: Connections between texts — Commentary, Midrash, Halakhah, Targum, Quoting Commentary, etc. These are the relationships that make the corpus interconnected.

**Topics**: 30,000+ topics organized in an ontology based on Basic Formal Ontology (BFO). Topics link to texts and to each other with typed relationships (is-a, child-of, related-to, applies-halacha, etc.).

### Search API (ElasticSearch)

Sefaria exposes an ES 8.8 proxy at `POST /api/search/text/_search`. Supports:
- Exact phrase matching on `exact` field
- Lemmatized Hebrew search on `naive_lemmatizer` field (handles prefixes, plurals, spelling variants)
- Relevance ranking via `pagesheetrank` (PageRank-like score based on internal links and citations)
- Category filtering via regex on `path` field
- Aggregations by category

Response includes `ref`, `heRef`, text content, `path` (category hierarchy), `categories`, `comp_date`, and `pagesheetrank`.

---

## Phase 1: Topic-Based Index + Sefaria Search (No Vector DB)

### Architecture

```
User Question
    │
    ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Claude LLM  │────▶│  Sefaria Search  │────▶│  Sefaria     │
│  (reasoning) │     │  + Topic Lookup  │     │  Texts API   │
│              │◀────│                  │◀────│              │
└──────────────┘     └──────────────────┘     └──────────────┘
    │                                               │
    ▼                                               │
┌──────────────┐     ┌──────────────────┐           │
│  Response     │     │  Local Q&A Store │◀──────────┘
│  with Sources │     │  (PostgreSQL)    │
└──────────────┘     └──────────────────┘
```

### 1.1 Topic Index (Local)

**What**: A local index of Sefaria's topic ontology with pre-computed relationships, stored in PostgreSQL.

**Why**: When a user asks "What does the Torah say about prayer?", the system needs to know which topics, texts, and categories are relevant — before hitting Sefaria's API. The topic index lets us map natural language concepts to Sefaria's structured data.

**Schema**:

```sql
-- Core topic metadata (seeded from Sefaria's /api/topics?limit=0)
CREATE TABLE topics (
    slug TEXT PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_he TEXT,
    description_en TEXT,
    description_he TEXT,
    category TEXT,                    -- ontology category
    parent_slugs TEXT[],             -- is-a relationships (ancestors)
    display_order INTEGER,
    ref_count INTEGER DEFAULT 0,     -- number of linked text refs
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Topic-to-topic relationships
CREATE TABLE topic_links (
    from_slug TEXT REFERENCES topics(slug),
    to_slug TEXT REFERENCES topics(slug),
    link_type TEXT NOT NULL,          -- is-a, related-to, child-of, etc.
    PRIMARY KEY (from_slug, to_slug, link_type)
);

-- Topic-to-text-ref mappings (seeded for high-value topics)
CREATE TABLE topic_refs (
    topic_slug TEXT REFERENCES topics(slug),
    ref TEXT NOT NULL,                -- Sefaria ref e.g. "Genesis 1:1"
    order_score REAL,                -- Sefaria's ordering score
    PRIMARY KEY (topic_slug, ref)
);

CREATE INDEX idx_topics_title ON topics USING gin(to_tsvector('english', title_en));
CREATE INDEX idx_topic_refs_ref ON topic_refs(ref);
```

**Seeding Strategy**:

1. Fetch all topics: `GET /api/topics?limit=0&minify=0`
2. For the top ~500 topics (by ref_count or display_order), fetch full data: `GET /api/topics/{slug}?with_links=1&with_refs=1`
3. Store topic metadata, inter-topic links, and topic-ref mappings
4. Run this as a nightly cron job to stay in sync

### 1.2 Query Pipeline (Study Partner)

When a user asks a question, the pipeline:

**Step 1 — Intent Classification** (Claude)
Claude classifies the question:
- **Text lookup**: "What does Genesis 1:1 say?" → direct ref lookup
- **Topic exploration**: "What does Judaism say about prayer?" → topic search
- **Commentary request**: "What does Rashi say about Genesis 1:1?" → linked commentary
- **Comparative**: "How do Rambam and Ramban differ on free will?" → multi-topic
- **Halachic**: "Is it permissible to..." → halachic category search

Claude also extracts: key concepts, potential Sefaria refs, Hebrew terms, relevant categories.

**Step 2 — Retrieval** (multiple strategies in parallel)

| Strategy | When | API Call |
|---|---|---|
| **Direct ref** | User mentions a specific text | `GET /api/v3/texts/{ref}` + `GET /api/related/{ref}` |
| **Topic lookup** | Concepts identified | Query local `topics` table → `GET /api/topics/{slug}?with_refs=1` |
| **ES search** | Always (broad net) | `POST /api/search/text/_search` with extracted terms |
| **Category filter** | Domain identified (Talmud, Halakhah, etc.) | ES search with `path` regex filter |
| **Link expansion** | After finding relevant refs | `GET /api/links/{ref}?with_text=1` for commentaries |
| **Dicta parallels** | User quotes/paraphrases Hebrew text | `POST parallels.dicta.org.il/parallels/api/findincorpus` |
| **Dictionary lookup** | User asks about a word/term | `GET /api/words/{word}` (Jastrow, BDB, Klein) |
| **Citation detection** | User pastes text with embedded refs | `POST /api/find-refs` (async, CNN/BERT models) |

**Step 3 — Ranking & Selection**
- Deduplicate refs
- Rank by: `pagesheetrank` (Sefaria's score), topic relevance, category match, recency of composition
- Select top 5-10 passages to include in Claude's context

**Step 4 — Generation** (Claude)
Claude receives the question + retrieved passages and generates a response with citations in the format `[Source, Reference]`.

**Step 5 — Store Q&A**
Save the question, answer, and source refs locally (see §1.4).

### 1.3 Query Pipeline (Torah Search)

Simpler than Study Partner — focused on finding relevant passages:

1. User enters a search query
2. System runs parallel searches:
   - **ES text search**: `POST /api/search/text/_search` (both exact and lemmatized)
   - **Topic match**: Query local topics table for matching slugs → fetch their refs
3. Merge and deduplicate results
4. For each result, fetch a text snippet via `GET /api/v3/texts/{ref}?return_format=text_only`
5. Display ranked results with ref, snippet, category, and links to Sefaria

### 1.4 Local Q&A Store (SEO/AEO)

Every question and answer is stored for future reference, caching, and SEO.

```sql
CREATE TABLE qa_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    question_normalized TEXT NOT NULL,  -- lowercased, stripped
    answer_markdown TEXT NOT NULL,
    answer_html TEXT NOT NULL,
    source_refs TEXT[] NOT NULL,        -- Sefaria refs cited
    topics TEXT[],                      -- topic slugs relevant
    categories TEXT[],                  -- e.g. ['Tanakh', 'Halakhah']
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now(),
    view_count INTEGER DEFAULT 0,
    slug TEXT UNIQUE                    -- URL-friendly slug for SEO pages
);

CREATE INDEX idx_qa_question ON qa_pairs USING gin(to_tsvector('english', question));
CREATE INDEX idx_qa_refs ON qa_pairs USING gin(source_refs);
CREATE INDEX idx_qa_topics ON qa_pairs USING gin(topics);
CREATE INDEX idx_qa_slug ON qa_pairs(slug);
```

**SEO/AEO Strategy**:
- Generate a URL-friendly slug for each Q&A (e.g., `/answers/what-does-rashi-say-about-genesis-1-1`)
- Render as static pages with structured data (JSON-LD `FAQPage` schema)
- Include Hebrew text, English translation, and source citations
- Internal linking between related Q&A pages based on shared topics/refs
- Sitemap auto-generation for all Q&A pages

**Duplicate Detection**:
Before generating a new answer, search existing Q&A by normalized question (trigram similarity) and topic overlap. If a close match exists (>0.8 similarity), return the cached answer instead of calling Claude + Sefaria again.

### 1.5 API Route Design

```
POST /api/study          — Study Partner (streaming response)
POST /api/search         — Torah Search (returns ranked results)
GET  /api/answers/:slug  — Cached Q&A page (for SEO)
GET  /api/topics/:slug   — Proxy/cache for Sefaria topic data
```

### 1.6 Caching Strategy

| Data | Cache Location | TTL |
|---|---|---|
| Topic index | PostgreSQL | Refresh nightly |
| Table of Contents | PostgreSQL | Refresh weekly |
| Sefaria text responses | Redis or in-memory | 24 hours |
| ES search results | In-memory | 1 hour |
| Dictionary lookups | Redis or in-memory | 7 days |
| Dicta parallel results | In-memory | 1 hour |
| Q&A pairs | PostgreSQL | Permanent |

---

## Phase 2: Vector Embeddings (Semantic Search)

### Why Phase 2 Is Separate

The chunking strategy for Torah texts is non-trivial:
- A single Talmud sugya can span multiple amudim
- Commentary structure is deeply nested (Rashi on Rashi on Gemara)
- Hebrew/Aramaic text requires specialized tokenization
- Verse-level chunks may be too small; chapter-level too large
- The relationship between a commentary and its base text is semantic, not just structural

Phase 1 establishes the pipeline and lets us observe real user queries before committing to a chunking strategy.

### 2.1 Chunking Strategy (TBD — Informed by Phase 1 Data)

Candidate approaches to evaluate based on Phase 1 usage patterns:

| Strategy | Unit | Pros | Cons |
|---|---|---|---|
| **Verse/segment** | Individual verse or Mishnah segment | Precise citations, small context | Often too small for meaning |
| **Passage** | Sefaria's `/api/passages` boundaries (sugya, parasha) | Semantically coherent | Variable size, some very long |
| **Sliding window** | N segments with M overlap | Consistent size | Breaks mid-thought |
| **Commentary bundle** | Base text + all commentaries | Rich context | Very large, mixed languages |
| **Topic cluster** | All refs for a topic, concatenated | Topically coherent | Massive, redundant |

**Recommendation**: Start with Sefaria's passage boundaries (sugyot for Talmud, parshiyot for Tanakh, individual mishnayot for Mishnah) and evaluate retrieval quality before experimenting with alternatives.

### 2.2 Data Source for Embeddings

**Do not scrape the Sefaria API for bulk embedding ingestion.** Sefaria explicitly advises against this. Instead, use the **Sefaria-Export** repo (`github.com/Sefaria/Sefaria-Export`) which provides the complete library as JSON files — the correct source for batch embedding pipelines.

For incremental updates and real-time lookups, use the API (`GET /api/v3/texts/{ref}?return_format=text_only`).

### 2.3 Embedding Pipeline

```
Sefaria-Export JSON
    │
    ▼
┌──────────────────┐
│ Text Extraction   │  Parse JSON exports (Hebrew + English)
│ + API fallback    │  GET /api/v3/texts/{ref}?return_format=text_only
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Metadata Enrichment│  Add: category, topics, era, author, pagesheetrank
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ Embedding Model   │  See model options below
└──────────────────┘
    │
    ▼
┌──────────────────┐
│ pgvector Store    │  Stored with ref, text, metadata for filtering
└──────────────────┘
```

### 2.4 Embedding Model Selection

Sefaria has experimented with several embedding models (in their unreleased LLM repo). Their findings inform our choice:

| Model | Dimensions | Notes |
|---|---|---|
| `text-embedding-3-large` (OpenAI) | 3072 | Sefaria's primary choice for ChromaDB experiments. Best quality but expensive and large vectors. |
| `text-embedding-3-small` (OpenAI) | 1536 | Good balance of cost/quality. Sefaria's default in their langchain abstraction. **Recommended for Phase 2 start.** |
| `voyage-large-2-instruct` (VoyageAI) | — | Sefaria tested as alternative. Good for instruction-tuned retrieval. |
| `gemini-embedding-001/002` (Google) | 256–3072 | Sefaria ran evaluation experiments across dimensions. Variable-dimension output is interesting for cost optimization. |

**Recommendation**: Start with `text-embedding-3-small` (1536d) for cost efficiency. Sefaria's own experiments show `text-embedding-3-large` performs best, but the 2x vector size doubles pgvector storage and query cost. Upgrade to `text-embedding-3-large` if retrieval quality is insufficient.

### 2.5 pgvector Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE text_embeddings (
    id SERIAL PRIMARY KEY,
    ref TEXT NOT NULL UNIQUE,          -- Sefaria ref
    he_ref TEXT,                       -- Hebrew ref
    text_en TEXT,                      -- English text
    text_he TEXT,                      -- Hebrew text
    embedding vector(1536),            -- embedding vector
    category_path TEXT[],              -- e.g. ['Tanakh', 'Torah', 'Genesis']
    topics TEXT[],                     -- topic slugs
    comp_date INTEGER,                 -- composition date
    author TEXT,
    passage_ref TEXT,                  -- canonical passage (from /api/passages)
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_embeddings_vector ON text_embeddings
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_embeddings_category ON text_embeddings USING gin(category_path);
CREATE INDEX idx_embeddings_topics ON text_embeddings USING gin(topics);
```

### 2.6 Hybrid Retrieval (Phase 2)

Phase 2 augments Phase 1's pipeline with vector search:

1. **Vector search**: Embed the user's query → cosine similarity against `text_embeddings`
2. **ES keyword search**: Same as Phase 1
3. **Topic lookup**: Same as Phase 1
4. **Dicta parallels**: For Hebrew text input, query the Dicta Parallels API for textual matches
5. **Reciprocal Rank Fusion**: Merge results from all sources, re-rank
6. Feed top results to Claude for generation

### 2.7 Embedding Scope

Start with a focused corpus, expand based on usage:

| Priority | Corpus | Est. Passages | Rationale |
|---|---|---|---|
| P0 | Torah (Chumash) | ~200 parshiyot | Most queried |
| P0 | Rashi on Torah | ~200 | Most common commentary |
| P1 | Mishnah | ~525 chapters | Core oral law |
| P1 | Talmud Bavli | ~2,700 sugyot | Central to learning |
| P2 | Midrash Rabbah | ~500 | Aggadic content |
| P2 | Rambam Mishneh Torah | ~1,000 | Halachic code |
| P3 | Everything else | 50,000+ | Long tail |

---

## Implementation Roadmap

### Phase 1 Milestones

1. **Topic Index Seeder** — Script to fetch and store Sefaria topics, links, and ref mappings
2. **Search Proxy** — Backend endpoint wrapping Sefaria ES search with topic enrichment
3. **Study Pipeline** — Claude integration with multi-strategy retrieval
4. **Q&A Store** — Database + API for storing and retrieving past answers
5. **SEO Pages** — Static rendering of Q&A pairs with structured data

### Phase 2 Milestones (After Phase 1 is live)

1. **Analyze Phase 1 queries** — What topics/refs are most requested? What queries fail?
2. **Choose chunking strategy** — Based on real usage patterns (see §2.1)
3. **Download Sefaria-Export** — Clone `github.com/Sefaria/Sefaria-Export` for bulk JSON data
4. **Embedding pipeline** — Batch embed priority corpus using `text-embedding-3-small` (see §2.4)
5. **Hybrid retrieval** — Add vector search + Dicta parallels alongside ES + topic lookup
6. **Evaluate** — Compare retrieval quality Phase 1 vs Phase 2, consider upgrading to `text-embedding-3-large` if needed

### Lessons from Sefaria's Architecture

Key takeaways from analyzing Sefaria's internal ML/AI infrastructure:

1. **Multi-model strategy works**: Sefaria uses cheap models (GPT-4o-mini) for simple tasks (keyword extraction, scoring) and expensive models (Claude Sonnet) for complex reasoning (disambiguation, ranking). We should follow the same pattern — use Claude Haiku or GPT-4o-mini for intent classification, Claude Sonnet for generation.
2. **Graph-based recommendations are a strong baseline**: Sefaria's link co-occurrence + PageSheetRank recommendation engine works well without any ML. Our Phase 1 topic index + link graph will be similarly effective.
3. **The Dicta Parallels API is production-tested**: Sefaria uses it in their disambiguator. It's a free, external service for finding Hebrew textual parallels — we should integrate it early.
4. **LLM caching is essential**: Sefaria uses SQLite caching for all LLM calls. We should cache at multiple layers (Q&A pairs in PG, API responses in Redis, LLM outputs in-memory).
5. **PageSheetRank is the authority signal**: Sefaria's combined PageRank + sheet frequency score (`(log(pagerank) + 20) * (1 + sheetrank/5)^2`) is available via the search API's `pagesheetrank` field. Use it for relevance boosting in all retrieval strategies.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Primary data source | Sefaria API (real-time) + Sefaria-Export (bulk) | API for lookups; Export repo for embedding ingestion (Sefaria advises against API scraping for bulk) |
| Local index | Topic ontology + Q&A pairs | Know what to search for; cache results for SEO |
| Phase 1 search | Sefaria ES proxy + topic lookup + Dicta parallels | Works today, no embedding pipeline needed. Dicta adds Hebrew fuzzy matching. |
| Phase 2 search | pgvector + hybrid retrieval | True semantic search — a capability Sefaria itself doesn't have in production |
| Phase 2 embeddings | `text-embedding-3-small` (1536d) | Sefaria tested `text-embedding-3-large` (3072d) but cost/storage is 2x; start small, upgrade if needed |
| Q&A storage | PostgreSQL | Already in the stack, supports full-text search |
| LLM | Claude (Anthropic) | Already integrated; Sefaria uses Claude Sonnet for their most complex reasoning tasks (disambiguation) |
| Dictionary | Sefaria Lexicon API | Jastrow, BDB, Klein — term definitions for Study Partner without maintaining our own dictionary |
| Caching | Multi-layer (PG + Redis + in-memory) | Reduce Sefaria API calls, faster responses |

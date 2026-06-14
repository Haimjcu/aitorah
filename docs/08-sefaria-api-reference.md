# 08 — Sefaria API Reference (for AI Torah)

## Overview

Sefaria's API is open (no auth required) with 62+ endpoints. This document covers the endpoints relevant to AI Torah's RAG system.

Base URL: `https://www.sefaria.org`

For AI agents: `https://developers.sefaria.org/llms.txt`

MCP Servers:
- Texts: `https://mcp.sefaria.org/sse`
- Developer docs: `https://developers.sefaria.org/mcp`

Contact: developers@sefaria.org

---

## Multi-Repository Architecture

Sefaria's AI capabilities span multiple repos:

| Repo | Purpose | AI Relevance |
|---|---|---|
| **Sefaria/Sefaria-Project** | Main Django/React monolith | Citation disambiguator (LLM), ES search, graph-based recommendations, PageSheetRank |
| **Sefaria/LLM** (v1.3.6) | LLM integration service (Celery worker on K8s) | Topic prompt generation, sheet scoring, translation, linker resolution, embedding experiments |
| **Sefaria/ne_span** (v1.0.2) | Named entity span data structures | NER labels and span types for citation/person detection |
| **Sefaria/Sefaria-Export** | Complete library export in JSON | Bulk data for embedding ingestion — Sefaria explicitly advises against API scraping for bulk data |

### LLM Models in Production

| Model | Provider | Usage |
|---|---|---|
| `gpt-4o` | OpenAI | Topic prompts, uniqueness detection, contextualization, style guide |
| `gpt-4o-mini` | OpenAI | Sheet scoring, keyword extraction in linker, topic modelling |
| `claude-sonnet-4-6` | Anthropic | Citation disambiguation reasoning, commentary ranking |
| `claude-3-5-haiku` | Anthropic | Linker citation disambiguation (confirmation/choice) |
| `claude-3-haiku` | Anthropic | Commentary summarization, question translation |

### Embedding Models (Experimental — not in production)

| Model | Provider | Dimensions | Usage |
|---|---|---|---|
| `text-embedding-3-large` | OpenAI | 3072 | ChromaDB ingestion and querying (primary) |
| `text-embedding-3-small` | OpenAI | 1536 | Default in langchain abstraction |
| `text-embedding-ada-002` | OpenAI | 1536 | Neo4j vector store |
| `voyage-large-2-instruct` | VoyageAI | — | Source querying and clustering (alternative) |
| `gemini-embedding-001/002` | Google | 256–3072 | Embedding evaluation experiments |

**Key insight**: Sefaria has **no production vector/semantic search**. ChromaDB and Neo4j are used only in experimental topic source curation pipelines in the LLM repo. Production search is purely lexical ES.

---

## Text Retrieval

### GET /api/v3/texts/{tref}

The primary endpoint for fetching text content.

**Path**: `tref` — a Sefaria reference (e.g., `Genesis 1:1`, `Berakhot 2a`, `Rashi on Genesis 1:2:1`)

**Query Params**:
| Param | Values | Description |
|---|---|---|
| `version` | `primary`, `source`, `translation`, `all`, or `language\|versionTitle` | Which text version(s) to return |
| `fill_in_missing_segments` | `0` (default), `1` | Fill gaps from other versions |
| `return_format` | `default`, `text_only`, `strip_only_footnotes`, `wrap_all_entities` | Text formatting |

**Notes**:
- Non-segment refs resolve to first section (e.g., `Genesis` → `Genesis 1`)
- `text_only` strips all HTML, footnotes, and tags — best for embeddings/LLM context
- Multiple `version` params supported

### GET /api/bulktext/{refs}

Fetch multiple texts in one call. Refs are pipe-delimited: `Genesis 1:1|Exodus 2:3|Berakhot 2a`

### GET /api/passages/{refs}

Maps refs to canonical passage boundaries. Pipe-delimited refs.
- Talmud: amud → full sugya
- Tanakh: verse → parasha

---

## Links & Connections

### GET /api/links/{tref}

Returns all known connections for a text ref.

**Query Params**:
| Param | Default | Description |
|---|---|---|
| `with_text` | `1` | Include text content of linked passages |
| `with_sheet_links` | `0` | Include user source sheet links |
| `category` | — | Filter by category (repeatable) |
| `categories` | — | Filter by category (comma/pipe separated) |

**Link Categories**: Commentary, Midrash, Halakhah, Targum, Quoting Commentary, Essay, Reference, etc.

### GET /api/link-summary/{ref}

Summary of all links for a ref, grouped by category with per-book breakdowns. Useful for showing "12 commentaries, 3 midrashim" without fetching full content.

### GET /api/related/{tref}

All related content in one call: links, sheets, notes, media, manuscripts, topics.

### GET /api/ref-topic-links/{tref}

All topics linked to a given text ref.

---

## Topics

### GET /api/topics

All topics in the database (30,000+).

**Query Params**:
| Param | Default | Description |
|---|---|---|
| `limit` | `1000` | Number of topics. `0` = all |
| `minify` | `1` | `1` = essential fields only; `0` = full data including images |

### GET /api/topics/{slug}

Single topic metadata.

**Query Params**:
| Param | Description |
|---|---|
| `with_links` | Include intra-topic links |
| `annotate_links` | Add metadata to links (title, shouldDisplay, order) |
| `group_related` | Group link types for sidebar layout |
| `with_refs` | Include list of text refs tagged with this topic |
| `annotate_time_period` | Include time period data |

### GET /api/topics-graph/{slug}

Topic and its links to other topics — useful for traversing the ontology.

### GET /api/recommend/topics/{refs}

Given refs, returns the most relevant topics. Useful for post-query topic enrichment.

---

## Search (ElasticSearch Proxy)

### POST /api/search/text/_search

Full-text search across the Sefaria library.

**Headers**: `Content-Type: application/json`

**Body Structure**:
```json
{
  "from": 0,
  "size": 10,
  "query": { ... },
  "highlight": { ... },
  "aggs": { ... }
}
```

**Query Types**:

**Exact phrase**: `{ "match_phrase": { "exact": { "query": "search term" } } }`

**Lemmatized Hebrew**: `{ "match_phrase": { "naive_lemmatizer": { "query": "term", "slop": 1 } } }`

**Ranked**: Wrap query in `function_score` with `pagesheetrank` field:
```json
{
  "function_score": {
    "field_value_factor": { "field": "pagesheetrank", "missing": 0.04 },
    "query": { ... }
  }
}
```

**Category filter**: Use `bool` → `filter` with regex on `path`:
```json
{
  "bool": {
    "must": { ... },
    "filter": { "bool": { "should": [
      { "regexp": { "path": "Talmud.*" } }
    ]}}
  }
}
```

**Response fields per hit**:
- `ref` / `heRef` — Sefaria reference
- `exact` / `naive_lemmatizer` — text content
- `path` — category hierarchy (e.g., `Tanakh/Torah/Genesis`)
- `categories` — text classification
- `comp_date` — composition date
- `pagesheetrank` — relevance score
- `version` — text version name

### POST /api/search/sheet/_search

Same structure, searches user source sheets instead of library texts.

---

## Library Structure

### GET /api/index

Table of Contents — all books organized by category. **Large response — cache locally.**

**Query Params**: `include_authors` (`0`/`1`)

### GET /api/index/{title}

Metadata for a single book: schema, categories, author, dates, descriptions.

### GET /api/index/titles

Complete list of all recognized title strings. **Multiple megabytes — cache.**

### GET /api/category/{path}

Category metadata. Path is slash-separated (e.g., `Tanakh/Torah`).

---

## Calendar & Discovery

### GET /api/calendars

Daily/weekly learning schedule (Daf Yomi, Parasha, etc.).

**Query Params**: `diaspora` (`0`/`1`), `custom` (learning schedule name)

### GET /api/name/{name}

Autocomplete and ref resolution. Returns potential matches for refs, titles, authors, topics, collections. Useful for parsing user queries into valid Sefaria refs.

### GET /api/texts/random

Random text reference from the library.

### GET /api/random-by-topic/{slug}

Random text from a specific topic.

---

## AI-Powered Citation Detection

### POST /api/find-refs

AI-powered citation finder using CNN (English) and BERT (Hebrew) models. Async — returns a task ID.

**Body**: `{"text": {"title": "...", "body": "..."}}`

**Response**: `202` with `{"task_id": "..."}` — poll via `GET /api/async/{task_id}`

**Parameters**:
| Param | Description |
|---|---|
| `with_text` | Include resolved text content |
| `debug` | Return debug info |
| `max_segments` | Limit segments processed |

Supports ibid citations and ambiguous references. The NER model runs on a separate GPU server (spaCy-based, not in the main repo).

---

## Lexicon / Dictionary

### GET /api/words/{word}

Dictionary lookup across multiple lexicons.

**Available dictionaries**: Jastrow, BDB (Brown-Driver-Briggs), Klein, Strong's, Hebrew Dictionary

**Parameters**: `lookup_ref`, `never_split`, `always_split`, `always_consonants`

**Response fields**: `headword`, `parent_lexicon`, `content.senses[].definition`, morphology, transliteration

### GET /api/words/completion/{word}/{lexicon}

Word autocomplete within a specific dictionary.

---

## External Services

### Dicta Parallels API

`POST https://parallels-3-0a.loadbalancer.dicta.org.il/parallels/api/findincorpus`

External Hebrew text similarity service used by Sefaria's disambiguator. Finds textual parallels in the Hebrew corpus. Useful for detecting when a user quotes or paraphrases a Torah text.

---

## Topic Ontology Structure

Built on Basic Formal Ontology (BFO):

```
entity
├── continuant (things that persist)
│   ├── independent (people, objects, places)
│   ├── specifically dependent (qualities, relationships)
│   └── generically dependent (laws, philosophies, texts)
└── occurrent (events, processes)
    ├── processes (acts taking time)
    ├── temporal regions (holidays, seasons)
    └── process boundaries (beginnings, endings)
```

**Relationship types between topics**:
- `is-a` — taxonomic (Moses is-a prophet)
- `child-of` / `parent-of` — genealogical
- `related-to` — general association
- `similar-to` / `synonymous-with`
- `taught` / `learned-from` — pedagogical
- `applies-halacha` — halachic application
- `has-role` — functional
- `physically-contains` / `adjacent-to` — spatial
- `temporally-contains` / `precedes` — temporal

---

## Internal Data Architecture

### Recommendation Engine (Production — Graph-Based, Not ML)

Sefaria's recommendation engine uses **no embeddings or learned models**. Algorithm:
1. Find related texts through direct links and commentary links
2. Find related texts through shared source sheets
3. Score by `relevance * novelty` where novelty = `inverse_pagesheetrank`
4. Cluster nearby refs and merge

Scoring constants: `DIRECT_LINK_SCORE = 2.0`, `COMMENTARY_LINK_SCORE = 0.7`, `SHEET_REF_SCORE = 1.0`

### Bulk Data Access

Sefaria advises against API scraping for bulk data. Complete library exports in JSON are available at `github.com/Sefaria/Sefaria-Export`. This is the recommended source for embedding pipeline ingestion.

### MongoDB Collections

| Collection | Python Class | Purpose |
|---|---|---|
| `index` | `Index` | Text definitions, schemas, metadata |
| `texts` | `Version` | Actual text content (jagged arrays) |
| `links` | `Link` | Text-to-text connections |
| `category` | `Category` | Category hierarchy |
| `topics` | `Topic` | Topic objects with taxonomy |
| `topic_links` | `IntraTopicLink` / `RefTopicLink` | Topic relationships |
| `ref_data` | `RefData` | Per-segment statistics (pagesheetrank) |

### Search Infrastructure

- **ElasticSearch 8.8.2** with custom `sefaria-naive-lemmatizer` plugin for Hebrew morphology
- Two indices (text + sheet) with A/B swapping for zero-downtime reindexing
- **PageSheetRank**: Combines citation-graph PageRank with source-sheet frequency
- External **Dicta** service integration for advanced Hebrew morphological search
- **No vector/semantic search** — purely lexical

#### ElasticSearch Text Index Fields (from source code `search.py:347`)

| Field | ES Type | Analyzer | Notes |
|---|---|---|---|
| `categories` | keyword | — | Category labels (filterable) |
| `category` | keyword | — | Primary category |
| `he_category` | keyword | — | Hebrew category name |
| `index_title` | keyword | — | Book title (English) |
| `he_index_title` | keyword | — | Book title (Hebrew) |
| `path` | keyword | — | Full category path e.g. `Tanakh/Torah/Genesis` |
| `he_path` | keyword | — | Hebrew category path |
| `order` | keyword | — | Sort ordering |
| `pagesheetrank` | double | — | Relevance score (not indexed, used in function_score) |
| `comp_date` | integer | — | Composition date (not indexed) |
| `version_priority` | integer | — | Version priority (not indexed) |
| `exact` | text | `exact_english` | Raw English text for exact phrase matching |
| `naive_lemmatizer` | text | `sefaria-naive-lemmatizer` | Hebrew-analyzed text (prefixes removed, plurals→singulars, spelling normalization). Search uses `sefaria-naive-lemmatizer-less-prefixes` analyzer. Has sub-field `.exact` for English fallback |
| `linked_refs` | keyword | — | Refs linked to this segment (excluded from `_source` to reduce response size) |

#### ElasticSearch Sheet Index Fields (from source code `search.py:415`)

| Field | ES Type | Analyzer |
|---|---|---|
| `owner_name` | keyword | — |
| `tags` | keyword | — |
| `topics_en` / `topics_he` | keyword | — |
| `topic_slugs` | keyword | — |
| `datePublished` / `dateCreated` / `dateModified` | date | — |
| `sheetId` | integer | — |
| `collections` | keyword | — |
| `title` | keyword | — |
| `views` | integer | — |
| `content` | text | `stemmed_english` |

#### Search Wrapper Endpoint (preferred over raw ES proxy)

`POST /api/search-wrapper/es8` — higher-level search endpoint that accepts a JSON body with:
- `type`: `"text"` or `"sheet"` (selects the ES index)
- Standard ES query params (`query`, `from`, `size`, `highlight`, `aggs`, `sort`)
- Returns ES response directly (hits, total, aggregations)

This is the endpoint the Sefaria frontend uses. Equivalent to the raw ES proxy but with proper CORS and timeout handling (5s).

#### PageSheetRank Algorithm (from `pagesheetrank.py`)

Combines two signals:
1. **PageRank** — classic PageRank over the citation graph (damping factor 0.85). Every link between texts is an edge.
2. **SheetRank** — frequency of citation in user-created source sheets.

Combined formula: `(log(pagerank) + 20) * (1 + sheetrank/5)^2`

Default value for uncited segments: `RefData.DEFAULT_PAGESHEETRANK`

---

### Sefaria's Disambiguator (LLM-powered — reference architecture)

Sefaria already has a production LLM pipeline for resolving ambiguous text references (`sefaria/helper/linker/disambiguator.py`). Relevant to our RAG design because it demonstrates a working Claude + search integration on Torah texts.

**Architecture**:
- Uses **Claude Sonnet** (via LangChain) for: forming priors about what a citation refers to, choosing between candidate refs, and confirming resolution
- Uses **GPT-4o-mini** for: keyword extraction and search query generation (cheaper model for simple tasks)
- Uses **Dicta Parallels API** (`parallels.dicta.org.il`) for: finding textual parallels in the Hebrew corpus
- Uses **Sefaria ES search** for: finding candidate text matches

**Pipeline steps**:
1. Extract citing context (windowed text around the citation span)
2. Query Dicta for textual parallels → get candidate refs
3. Query Sefaria ES search with LLM-generated keywords → get more candidates
4. Deduplicate and score candidates
5. LLM chooses best candidate with reasoning
6. LLM confirms the choice

**Key insight for our RAG**: Sefaria's disambiguator uses `naive_lemmatizer` field with high `slop` (20) for fuzzy Hebrew matching, and combines multiple retrieval sources (Dicta + ES) before LLM ranking. Our RAG should follow a similar multi-source retrieval strategy.

### Text Structure

Texts are stored as **jagged arrays** (nested lists):
- Bible: `chapter[chapter_idx][verse_idx] = "text"`
- Talmud: `chapter[daf_idx][line_idx] = "text"`
- Commentary: same structure mapped to base text

### Ref Format Examples

| Type | Example | Pattern |
|---|---|---|
| Bible verse | `Genesis 1:1` | `Book Chapter:Verse` |
| Bible range | `Exodus 12:2-8` | `Book Chapter:Verse-Verse` |
| Talmud | `Berakhot 2a` | `Tractate Daf[a/b]` |
| Mishnah | `Mishnah Berakhot 4.2` | `Mishnah Tractate Chapter:Mishnah` |
| Commentary | `Rashi on Genesis 1:2:1` | `Commentator on Book Chapter:Verse:Comment` |
| Rambam | `Rambam Laws of Repentance 2:1` | `Author LawsTopic Chapter:Halakhah` |
| Complex | `Pesach Haggadah, Kadesh` | `Title, SectionName` |

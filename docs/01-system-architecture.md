# System Architecture Overview — AI Torah

## 1. System Purpose

AI Torah is a digital ecosystem at the intersection of traditional Jewish scholarship and artificial intelligence. The platform serves scholars, developers, educators, and the general public through AI-powered Torah study tools, a community forum, a resource marketplace, and live event programming.

---

## 2. High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Users (Browser)                                │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ HTTPS
                    ┌────────────▼────────────┐
                    │    Next.js App (Railway) │  ◄── Sanity CDN (static assets)
                    │   (Frontend + API Routes)│
                    └──┬────────┬─────┬───────┘
                       │        │     │
          ┌────────────▼──┐  ┌──▼──┐  └──────────────────┐
          │  PostgreSQL   │  │Redis│                      │
          │  (Railway)    │  │Cache│            ┌─────────▼──────────┐
          │  ┌──────────┐ │  │     │            │  Discourse (Railway)│
          │  │ pgvector │ │  └─────┘            │  (Community Forum) │
          │  └──────────┘ │                     └────────────────────┘
          └───────────────┘
                │
    ┌───────────▼───────────┐
    │  External Services    │
    │  ┌─────────────────┐  │
    │  │  Sefaria API    │  │
    │  │  Stripe API     │  │
    │  │  Discord API    │  │
    │  │  Sanity API     │  │
    │  │  OpenAI/Anthrop.│  │
    │  └─────────────────┘  │
    └───────────────────────┘
```

---

## 3. Components

### 3.1 Next.js Application (Railway Service: `aitorah-web`)
- Serves all user-facing pages via React Server Components
- Handles all API logic via `/app/api/` route handlers (no separate Express server)
- Manages authentication via NextAuth.js (JWT sessions)
- Streams AI responses (Torah study partner, semantic search) to the browser
- Acts as Discourse SSO provider

### 3.2 PostgreSQL + pgvector (Railway Service: `aitorah-db`)
- Primary relational store: users, subscriptions, marketplace listings, orders, RLHF data
- pgvector extension stores Torah text embeddings for semantic search
- Single Railway Postgres instance with `vector` extension enabled

### 3.3 Redis (Railway Service: `aitorah-redis`)
- Session caching (NextAuth JWT + rate limiting)
- Queuing AI jobs (study partner conversations)
- Pub/sub for live event chat relay between Discord and the site

### 3.4 Sanity.io (External Managed Service)
- Headless CMS for non-developer contributors
- Content types: blog posts, app directory listings, events, resource pages, docs
- Delivers content via Sanity CDN; Next.js fetches at build time (ISR) and on-demand

### 3.5 Discourse (Railway Service: `aitorah-discourse`)
- Self-hosted on Railway using the official Discourse Docker image
- SSO linked to Next.js authentication (Discourse SSO protocol)
- Provides structured, searchable forum threads for halachic and technical discussion
- REST API used by Next.js to embed recent posts and activity on the main site

### 3.6 Discord (External)
- Real-time community hub: dev channels, onboarding, live event chat
- Bot bridges events and announcements from the main site to Discord
- Used for the Technical Implementation Lab real-time discussions

### 3.7 Stripe (External)
- Handles all marketplace transactions and subscription billing
- Webhook endpoint at `/api/webhooks/stripe` processes payment events
- Connected accounts for creator payouts

### 3.8 AI Layer (LLM Providers)
- Anthropic Claude (primary): Interactive Study Partner, Halachic Resource Engine
- OpenAI (fallback / embeddings): text-embedding-3-small for pgvector ingestion
- All LLM calls are routed through Next.js API routes — never called directly from the browser

---

## 4. Data Flows

### 4.1 Authentication Flow
```
User → Next.js /api/auth/signin
     → NextAuth validates credentials (email/password or OAuth)
     → Issues JWT stored in httpOnly cookie
     → On /community route: Next.js signs Discourse SSO payload
     → Redirects to Discourse with signed nonce
     → Discourse creates/syncs user account
```

### 4.2 Semantic Torah Search
```
Query text → /api/search
           → Generate embedding via OpenAI text-embedding-3-small
           → pgvector cosine similarity query against torah_texts table
           → Return ranked passages with metadata (source, book, chapter, verse)
           → Optionally: pass results to Claude for summarized answer
```

### 4.3 AI Study Partner (Streaming)
```
User message → /api/chat (POST, streaming)
             → Build context: conversation history + relevant Torah passages (RAG)
             → Stream Claude response via Vercel AI SDK
             → Response chunks sent via Server-Sent Events to browser
```

### 4.4 Content Delivery (Sanity → Browser)
```
Editor publishes in Sanity Studio
→ Sanity webhook hits /api/revalidate
→ Next.js ISR revalidates affected page
→ Next request serves fresh static page from Railway CDN
```

### 4.5 Marketplace Transaction
```
Buyer clicks purchase → /api/checkout (creates Stripe Session)
                      → Redirect to Stripe Checkout
                      → On success: Stripe webhook → /api/webhooks/stripe
                      → Order row written to PostgreSQL
                      → Email confirmation sent
```

---

## 5. Security Model

| Concern | Approach |
|---|---|
| Auth sessions | NextAuth JWT, httpOnly cookies, CSRF protection |
| API keys | Railway environment variables, never in client bundle |
| Database | Railway private network (not publicly reachable) |
| LLM prompt injection | Server-side prompt construction only, user input sanitized |
| Payments | Stripe handles card data; no PCI scope on our servers |
| Discourse SSO | HMAC-SHA256 signed payloads |
| Rate limiting | Redis-backed per-IP and per-user limits on AI endpoints |

---

## 6. Build Order (Phased)

| Phase | Services | Description |
|---|---|---|
| 1 | Next.js + PostgreSQL + Sanity | Auth, routing, CMS content, static pages |
| 2 | Discourse | Self-hosted forum, SSO with main site |
| 3 | Discord bot | Server setup, announcement bridge |
| 4 | pgvector + Torah corpus | Semantic search ingestion pipeline |
| 5 | AI Study Partner | RAG-based conversational interface |
| 6 | Marketplace | Stripe integration, product listings |
| 7 | RLHF infrastructure | Data labeling, feedback collection |

---

## 7. Railway Services Summary

| Service Name | Type | Notes |
|---|---|---|
| `aitorah-web` | Next.js | Main app, $5-20/mo |
| `aitorah-db` | PostgreSQL | With pgvector extension |
| `aitorah-redis` | Redis | Session cache + queuing |
| `aitorah-discourse` | Docker | Discourse forum |
| `aitorah-discourse-db` | PostgreSQL | Dedicated Discourse DB |

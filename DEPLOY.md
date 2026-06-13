# Deploy Instructions — AI Torah (current state)

This covers deploying the app as it exists today: a Next.js 14 frontend with a working Anthropic chat API and Resend contact form. The database, search, and feedback APIs are stubbed — they'll work once a PostgreSQL instance is connected and migrations are written.

## Prerequisites

- Node.js 20+ (local: v22.19.0)
- A [Railway](https://railway.app) account
- API keys for:
  - **Anthropic** — powers `/api/chat` (required)
  - **Resend** — powers `/api/contact` (required)
  - Sanity, Stripe, OpenAI, Discourse — not yet wired; can be added later

## Step 1: Prepare the codebase

Two files need to be created/updated before the first deploy.

### 1a. Enable standalone output

The current `next.config.mjs` is empty. Railway needs the standalone output mode.

```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
    ],
  },
}

export default nextConfig
```

### 1b. Add `railway.json`

Create `railway.json` in the project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node .next/standalone/server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

### 1c. Add a health check endpoint

Create `app/api/health/route.ts`:

```ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
```

### 1d. Commit and push

```bash
git add next.config.mjs railway.json app/api/health/route.ts
git commit -m "prepare for Railway deployment"
git push origin main
```

## Step 2: Create the Railway project

1. Go to [railway.app](https://railway.app) → **New Project** → **Empty Project**
2. Name it `ai-torah`

## Step 3: Deploy the Next.js app

1. Inside the project: **New Service** → **GitHub Repo** → select `aitorah`
2. Railway auto-detects Next.js via Nixpacks and reads `railway.json`
3. Set the following environment variables under **Variables**:

### Minimum viable env vars

| Variable | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | From console.anthropic.com |
| `RESEND_API_KEY` | `re_...` | From resend.com |
| `CONTACT_EMAIL` | `haim@aitorah.ai` | Where contact form submissions go |
| `NEXTAUTH_SECRET` | (generate) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://aitorah.com` | Or your Railway-provided URL for now |

These are the only env vars needed for the features that currently work.

### Optional (for future features)

```
DATABASE_URL          — add when PostgreSQL service is created
REDIS_URL             — add when Redis service is created
OPENAI_API_KEY        — needed for embeddings/search
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN
GOOGLE_CLIENT_ID      — OAuth sign-in
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY     — marketplace
```

## Step 4: Set up networking

### Option A: Use Railway's default URL (fastest)

Railway assigns a URL like `aitorah-web-production.up.railway.app`. No DNS setup needed — just use it.

### Option B: Custom domain

1. In the service settings → **Networking** → **Public Networking** → add `aitorah.com`
2. At your DNS provider, add:
   ```
   CNAME  @    <railway-provided-cname>.railway.app
   CNAME  www  <railway-provided-cname>.railway.app
   ```
3. SSL provisions automatically via Let's Encrypt (~5 minutes)

## Step 5: Verify the deploy

After Railway finishes building (2-3 minutes):

```bash
# Health check
curl https://<your-url>/api/health

# Chat API (streaming)
curl -X POST https://<your-url>/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What does the Torah say about honesty?"}]}'

# Contact form
curl -X POST https://<your-url>/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","interests":["AI Study Partner"]}'
```

Set the health check path in Railway: service → **Settings** → **Health Check Path** → `/api/health`.

## What works vs. what's stubbed

| Feature | Status | Depends on |
|---|---|---|
| Marketing pages (home, blog, community, events, contact, signin, signup) | Working | Nothing |
| AI Chat (`/api/chat`) | Working | `ANTHROPIC_API_KEY` |
| Contact form (`/api/contact`) | Working | `RESEND_API_KEY` |
| Torah search (`/api/search`) | Returns mock data | PostgreSQL + pgvector + ingestion script |
| RLHF feedback (`/api/feedback`) | Logs to console only | PostgreSQL |
| Auth (NextAuth) | Scaffolded, not connected | OAuth provider keys |
| Marketplace | Scaffolded, not connected | Stripe + PostgreSQL |
| Sanity CMS | Client configured, no content | Sanity project setup |

## Next steps to make stubbed features real

1. **Add PostgreSQL** — New Service → Database → PostgreSQL in Railway. Copy `DATABASE_URL` to app vars.
2. **Write Drizzle migrations** — the schema in `lib/db/schema.ts` is TypeScript interfaces only; needs Drizzle table definitions and a migration.
3. **Enable pgvector** — `CREATE EXTENSION IF NOT EXISTS vector;` in the Railway DB query tab.
4. **Write and run ingestion script** — `scripts/ingest-torah.ts` doesn't exist yet.
5. **Wire up search** — replace mock data in `/api/search` with pgvector queries.
6. **Wire up feedback** — write to `rlhf_feedback` table in `/api/feedback`.

## Redeploying

Railway auto-deploys on every push to `main`. To deploy manually:

```bash
git push origin main
```

To check deploy status: Railway dashboard → service → **Deployments** tab.

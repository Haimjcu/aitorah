# Railway Deployment Guide — AI Torah

## 1. Services Overview

All services live in a single Railway **Project** named `ai-torah`. Services communicate over Railway's private network (using `${{service.RAILWAY_PRIVATE_DOMAIN}}`), so the database and Redis are never publicly reachable.

| Service | Template / Image | Public URL |
|---|---|---|
| `aitorah-web` | Nixpacks (Next.js) | `aitorah.com` (custom domain) |
| `aitorah-db` | Railway PostgreSQL | Private only |
| `aitorah-redis` | Railway Redis | Private only |
| `aitorah-discourse` | `discourse/discourse_docker` | `community.aitorah.com` |
| `aitorah-discourse-db` | Railway PostgreSQL | Private only |

---

## 2. Initial Setup

### 2.1 Create Railway Project
1. Go to railway.app → New Project → Empty Project
2. Name it `ai-torah`
3. All services created below will be added to this project

### 2.2 Add PostgreSQL (Main DB)
1. New Service → Database → PostgreSQL
2. Name: `aitorah-db`
3. After creation, click the service → **Connect** tab
4. Copy the `DATABASE_URL` — add to `aitorah-web` environment variables
5. Enable pgvector:
   ```sql
   -- Run once via Railway's Query tab or psql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 2.3 Add Redis
1. New Service → Database → Redis
2. Name: `aitorah-redis`
3. Copy `REDIS_URL` → add to `aitorah-web` environment variables

### 2.4 Deploy Next.js App
1. New Service → GitHub Repo → select your repo
2. Name: `aitorah-web`
3. Railway auto-detects Next.js via Nixpacks
4. Set the **Start Command** to: `node .next/standalone/server.js`
5. Set the **Build Command** to: `npm run build`
6. Add all environment variables (see Section 5)
7. Under **Networking → Public Networking**, add custom domain: `aitorah.com`

#### `railway.json` (project root)
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

#### `next.config.ts` — required for Railway standalone build
```typescript
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

---

## 3. Database Setup (After First Deploy)

### 3.1 Run Drizzle Migrations
```bash
# From local machine with DATABASE_URL set
npx drizzle-kit migrate
```

Or add a Railway **Deploy Hook** to run migrations automatically:
- Pre-deploy command: `npx drizzle-kit migrate`

### 3.2 Enable pgvector and Create Indexes
```sql
-- Connect via Railway's Postgres service → Query tab
CREATE EXTENSION IF NOT EXISTS vector;

-- After torah_texts table is created by migration:
CREATE INDEX ON torah_texts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 3.3 Run Torah Text Ingestion (one-time)
```bash
# Locally, with DATABASE_URL and OPENAI_API_KEY set:
npx tsx scripts/ingest-torah.ts

# Or as a Railway one-off job:
# New Service → Cron Job → once → npx tsx scripts/ingest-torah.ts
```

---

## 4. Discourse Setup

Discourse requires a VM-like environment. On Railway, deploy it as a Docker service.

### 4.1 Add Discourse PostgreSQL
1. New Service → Database → PostgreSQL
2. Name: `aitorah-discourse-db`

### 4.2 Deploy Discourse
1. New Service → Docker Image → `discourse/base:release`
2. Name: `aitorah-discourse`
3. Add environment variables:
   ```
   DISCOURSE_DB_HOST=${{aitorah-discourse-db.PGHOST}}
   DISCOURSE_DB_NAME=${{aitorah-discourse-db.PGDATABASE}}
   DISCOURSE_DB_USERNAME=${{aitorah-discourse-db.PGUSER}}
   DISCOURSE_DB_PASSWORD=${{aitorah-discourse-db.PGPASSWORD}}
   DISCOURSE_HOSTNAME=community.aitorah.com
   DISCOURSE_SMTP_ADDRESS=smtp.sendgrid.net
   DISCOURSE_SMTP_USER_NAME=apikey
   DISCOURSE_SMTP_PASSWORD=<sendgrid_api_key>
   DISCOURSE_DEVELOPER_EMAILS=haim@justconnectus.com
   ```
4. Add custom domain: `community.aitorah.com`
5. After boot, SSH into the Discourse container and run:
   ```bash
   /var/www/discourse/bin/discourse-setup
   ```

### 4.3 Configure Discourse SSO
In Discourse Admin → Login:
- Enable `discourse_connect_enabled`
- Set `discourse_connect_url` to `https://aitorah.com/api/discourse/sso`
- Set `discourse_connect_secret` to match `DISCOURSE_SSO_SECRET` env var
- Disable local login (optional — force SSO only)

---

## 5. Environment Variables

Set all of these in Railway's `aitorah-web` service under **Variables**.

### Required at Launch
```
DATABASE_URL=${{aitorah-db.DATABASE_URL}}
REDIS_URL=${{aitorah-redis.REDIS_URL}}
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://aitorah.com
ANTHROPIC_API_KEY=<from console.anthropic.com>
OPENAI_API_KEY=<from platform.openai.com>
NEXT_PUBLIC_SANITY_PROJECT_ID=<from sanity.io>
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=<from sanity.io>
```

### OAuth (add when configuring sign-in)
```
GOOGLE_CLIENT_ID=<from console.cloud.google.com>
GOOGLE_CLIENT_SECRET=<from console.cloud.google.com>
DISCORD_CLIENT_ID=<from discord.com/developers>
DISCORD_CLIENT_SECRET=<from discord.com/developers>
```

### Marketplace
```
STRIPE_SECRET_KEY=<from dashboard.stripe.com>
STRIPE_WEBHOOK_SECRET=<from Stripe webhook settings>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from dashboard.stripe.com>
```

### Community
```
DISCOURSE_SSO_SECRET=<generate with: openssl rand -base64 32>
DISCOURSE_API_KEY=<from Discourse Admin → API>
DISCOURSE_URL=https://community.aitorah.com
SANITY_WEBHOOK_SECRET=<from sanity.io webhook config>
```

### Railway Internal (auto-set by Railway — no action needed)
```
PORT           # Railway sets this; Next.js reads it
RAILWAY_ENVIRONMENT
```

---

## 6. Custom Domains & SSL

Railway provides free TLS via Let's Encrypt for all custom domains.

1. `aitorah-web` → Networking → Add Domain → `aitorah.com`
2. Add CNAME record at your DNS provider:
   ```
   CNAME  @  <railway-provided-cname>.railway.app
   CNAME  www  <railway-provided-cname>.railway.app
   ```
3. `aitorah-discourse` → Add Domain → `community.aitorah.com`
   ```
   CNAME  community  <discourse-service-cname>.railway.app
   ```
4. SSL certificates provision automatically within ~5 minutes

---

## 7. CI/CD Pipeline

Railway auto-deploys on every push to `main`. For a safer flow:

### Recommended Branch Strategy
```
main     → Production (aitorah.com)
staging  → Staging Railway environment (staging.aitorah.com)
```

### Railway Environments
1. In your project, click **New Environment** → `staging`
2. Each environment has its own variable set and deployment
3. PRs deploy to staging automatically; merge to `main` deploys to production

### GitHub Actions — optional pre-deploy checks
```yaml
# .github/workflows/ci.yml
name: CI
on: [push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
```

---

## 8. Monitoring & Observability

| Concern | Tool |
|---|---|
| Logs | Railway built-in log viewer (stream from service) |
| Error tracking | Sentry (`@sentry/nextjs`) — add `SENTRY_DSN` env var |
| Uptime | Railway health checks — set Health Check Path to `/api/health` |
| DB performance | Railway Metrics tab (query time, connections) |

### Health Check Endpoint
```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
```

---

## 9. Scaling Considerations

| Threshold | Action |
|---|---|
| > 1000 concurrent users | Enable Railway auto-scaling (horizontal replicas) |
| pgvector slow (> 200ms) | Increase `lists` on IVFFlat index, or switch to HNSW |
| AI endpoint bottleneck | Move to Redis queue + background worker service |
| Discourse under load | Increase Discourse service RAM in Railway settings |

### Estimated Monthly Costs (baseline)
| Service | Cost |
|---|---|
| aitorah-web (512MB RAM) | ~$10/mo |
| aitorah-db (shared) | ~$5/mo |
| aitorah-redis | ~$5/mo |
| aitorah-discourse (2GB RAM) | ~$20/mo |
| **Total** | **~$40/mo** |

LLM API costs (Anthropic + OpenAI) are usage-based and billed separately.

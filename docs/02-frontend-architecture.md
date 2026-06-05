# Frontend Architecture — AI Torah

## 1. Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR + RSC for SEO, streaming AI, Railway-native |
| Language | TypeScript | Type safety across API/UI boundary |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI, accessible components, no CSS-in-JS overhead |
| CMS Client | `@sanity/client` + `next-sanity` | ISR + GROQ queries, live preview support |
| Auth | NextAuth.js v5 | JWT sessions, Discord/Google OAuth, Discourse SSO |
| Data Fetching | TanStack Query (client) + RSC (server) | RSC for initial load, TanStack for client mutations |
| AI Streaming | Vercel AI SDK (`ai` package) | useChat/useCompletion hooks, SSE streaming |
| Forms | React Hook Form + Zod | Type-safe validation, good DX |
| Animations | Framer Motion (selective) | Page transitions, AI typing indicators only |

---

## 2. Directory Structure

```
aitorah/
├── app/                          # Next.js App Router root
│   ├── (marketing)/              # Route group — public marketing pages
│   │   ├── page.tsx              # Homepage
│   │   ├── about/page.tsx
│   │   ├── pricing/page.tsx
│   │   └── layout.tsx            # Marketing layout (navbar, footer)
│   │
│   ├── (app)/                    # Route group — authenticated app
│   │   ├── layout.tsx            # App shell layout (sidebar, user nav)
│   │   ├── dashboard/page.tsx    # User dashboard
│   │   ├── study/                # AI Study Partner
│   │   │   ├── page.tsx          # New study session
│   │   │   └── [sessionId]/page.tsx
│   │   ├── search/page.tsx       # Semantic Torah search
│   │   ├── community/page.tsx    # Discourse embed + Discord link
│   │   ├── marketplace/
│   │   │   ├── page.tsx          # Browse listings
│   │   │   ├── [slug]/page.tsx   # Product detail
│   │   │   └── sell/page.tsx     # Creator listing form
│   │   ├── events/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── settings/page.tsx
│   │
│   ├── (content)/                # Route group — CMS-driven content
│   │   ├── blog/
│   │   │   ├── page.tsx          # Blog index (Sanity list)
│   │   │   └── [slug]/page.tsx   # Blog post (Sanity single)
│   │   ├── apps/
│   │   │   ├── page.tsx          # App directory
│   │   │   └── [slug]/page.tsx
│   │   ├── resources/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── docs/
│   │       ├── page.tsx
│   │       └── [slug]/page.tsx
│   │
│   ├── api/                      # API Route Handlers
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── chat/route.ts         # AI Study Partner (streaming)
│   │   ├── search/route.ts       # Semantic search
│   │   ├── checkout/route.ts     # Stripe checkout
│   │   ├── webhooks/
│   │   │   ├── stripe/route.ts
│   │   │   └── sanity/route.ts   # ISR revalidation
│   │   └── discourse/sso/route.ts
│   │
│   ├── globals.css
│   └── layout.tsx                # Root layout (fonts, providers)
│
├── components/
│   ├── ui/                       # shadcn/ui primitives (auto-generated)
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── AppShell.tsx
│   ├── study/
│   │   ├── ChatInterface.tsx     # Streaming chat UI
│   │   ├── MessageBubble.tsx
│   │   ├── SourceCard.tsx        # Torah citation display
│   │   └── StudySessionList.tsx
│   ├── search/
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   └── PassageCard.tsx
│   ├── marketplace/
│   │   ├── ListingCard.tsx
│   │   ├── ListingGrid.tsx
│   │   └── CheckoutButton.tsx
│   ├── content/
│   │   ├── PortableTextRenderer.tsx  # Sanity rich text
│   │   ├── BlogCard.tsx
│   │   ├── AppCard.tsx
│   │   └── EventCard.tsx
│   └── community/
│       ├── DiscourseEmbed.tsx
│       └── DiscordWidget.tsx
│
├── lib/
│   ├── sanity/
│   │   ├── client.ts             # Sanity client config
│   │   ├── queries.ts            # GROQ query library
│   │   └── image.ts              # urlFor helper
│   ├── db/
│   │   ├── index.ts              # pg/Drizzle client
│   │   └── schema.ts             # Drizzle ORM schema
│   ├── ai/
│   │   ├── embeddings.ts         # OpenAI embedding calls
│   │   └── prompts.ts            # System prompts for Study Partner
│   ├── auth.ts                   # NextAuth config
│   └── stripe.ts                 # Stripe client
│
├── types/
│   ├── sanity.ts                 # Generated from Sanity schema
│   └── db.ts                     # DB row types
│
├── sanity/                       # Sanity Studio (co-located)
│   ├── sanity.config.ts
│   ├── schemas/                  # See Sanity Schema Design doc
│   └── studio/page.tsx           # Embedded at /studio
│
└── public/
    └── fonts/                    # Hebrew + Latin web fonts
```

---

## 3. Routing Strategy

### Route Groups
Three route groups isolate layout logic:
- `(marketing)` — full-width public pages, no auth required, optimized for SEO
- `(app)` — authenticated shell with sidebar navigation
- `(content)` — CMS-driven pages with blog/docs layout

### Dynamic Routes
| Pattern | Purpose |
|---|---|
| `/blog/[slug]` | Sanity blog post by slug |
| `/apps/[slug]` | App directory listing |
| `/study/[sessionId]` | Saved study session |
| `/marketplace/[slug]` | Product listing |
| `/events/[slug]` | Event detail page |

### Auth-Protected Routes
Middleware at `middleware.ts` protects the `(app)` route group. Unauthenticated users are redirected to `/signin`.

---

## 4. Component Hierarchy

```
RootLayout (fonts, ThemeProvider, SessionProvider, QueryProvider)
│
├── (marketing)/Layout
│   ├── Navbar (logo, nav links, sign-in CTA)
│   ├── [Page Content]
│   └── Footer
│
└── (app)/AppShell
    ├── Sidebar
    │   ├── Logo
    │   ├── NavLinks (Study, Search, Community, Marketplace, Events)
    │   └── UserMenu
    └── MainContent
        ├── study/
        │   └── ChatInterface
        │       ├── MessageList
        │       │   └── MessageBubble (user | assistant)
        │       │       └── SourceCard[] (Torah citations)
        │       └── ChatInput
        ├── search/
        │   ├── SearchBar
        │   └── SearchResults
        │       └── PassageCard[]
        └── marketplace/
            └── ListingGrid
                └── ListingCard[]
```

---

## 5. State Management

| State Type | Tool | Location |
|---|---|---|
| Server state (CMS content) | React Server Components | Fetched in RSC, no client state |
| Server state (user data) | TanStack Query | `useQuery` in client components |
| Chat conversation history | Vercel AI SDK `useChat` | Local to `ChatInterface.tsx` |
| Search results | TanStack Query | `useQuery` on debounced input |
| Auth session | NextAuth `useSession` | Provider in root layout |
| UI state (sidebar open, modals) | Zustand | `stores/ui.ts` |
| Forms | React Hook Form | Local to each form component |

No global Redux or complex state store — data lives in the server where possible, TanStack Query for async client state, Zustand only for ephemeral UI state.

---

## 6. Sanity CMS Integration

### Fetching Pattern
- Static pages (blog, apps, events): `generateStaticParams` + `generateMetadata` using GROQ at build time, ISR with 60s revalidation
- Dynamic preview: `draftMode()` + live Sanity preview via `@sanity/preview-kit`
- Revalidation on publish: Sanity webhook → `/api/webhooks/sanity` → `revalidatePath`

### GROQ Query Pattern
```typescript
// lib/sanity/queries.ts
export const blogPostQuery = groq`
  *[_type == "blogPost" && slug.current == $slug][0] {
    title, body, publishedAt, author->{name, image},
    "categories": categories[]->title
  }
`
```

---

## 7. AI Study Partner UI

The chat interface uses Vercel AI SDK's `useChat` hook with streaming:

```
User types question
  → POST /api/chat with message array
  → Server builds RAG context (pgvector search)
  → Claude streams response tokens
  → useChat appends tokens to message in real time
  → SourceCard components render cited passages below response
```

Typing indicator shown while stream is active. Each assistant message includes collapsible "Sources" section showing Torah passages used in the response.

---

## 8. Hebrew Text Rendering

- Font: `Noto Sans Hebrew` via `next/font/google`
- Direction: `dir="rtl"` on Hebrew text containers
- Torah passage cards toggle between Hebrew source and English translation
- `lang` attribute set correctly on all Hebrew text nodes for accessibility

---

## 9. Performance Targets

| Metric | Target |
|---|---|
| LCP (homepage) | < 2.5s |
| CLS | < 0.1 |
| First AI token | < 1s after submit |
| Search results | < 500ms |
| Bundle size (initial JS) | < 150kb gzipped |

Achieved via: RSC for zero-JS content pages, streaming for AI, ISR for CMS content, `next/image` for all images.

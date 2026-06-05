# Website Design Document — AI Torah

## 1. Brand Identity

### 1.1 Design Philosophy
AI Torah sits at the intersection of ancient wisdom and modern technology. The visual language should feel:
- **Scholarly but accessible** — not sterile academic, not flashy startup
- **Warm and inviting** — welcoming newcomers while respecting depth
- **Technically credible** — developers should feel at home
- **Authentically Jewish** — subtle nods to Hebrew typography and Jewish art without being kitschy

### 1.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#1a3a5c` | Navy blue — headers, CTAs, nav |
| `--primary-light` | `#2563eb` | Interactive elements, links |
| `--accent` | `#b5914a` | Gold — filled buttons, active Torah quote borders |
| `--accent-dark` | `#8a6a2e` | Hover/active state on gold buttons |
| `--accent-light` | `#f0d080` | Badge backgrounds, section tints — always pair with `--accent-text` |
| `--accent-text` | `#7a5c1e` | Text on `--accent-light` backgrounds (passes 4.5:1 contrast) |
| `--background` | `#fafaf8` | Warm off-white — page background |
| `--surface` | `#ffffff` | Cards, modals |
| `--surface-alt` | `#f4f3ef` | Alternate section backgrounds |
| `--text-primary` | `#1a1a1a` | Body text |
| `--text-secondary` | `#6b7280` | Captions, metadata |
| `--text-hebrew` | `#1a3a5c` | Hebrew text, always navy |
| `--success` | `#16a34a` | Confirmations |
| `--error` | `#dc2626` | Errors |
| `--border` | `#e5e3db` | Warm gray borders |

**Gold usage rule:** Use `--accent` (#b5914a) on dark or white surfaces — it passes contrast as a border, icon, or button label on white. For filled gold badges or tinted section backgrounds, use `--accent-light` (#f0d080) as the background and `--accent-text` (#7a5c1e) as the text — never `--text-primary` or white, which both fail contrast on that yellow. `--accent-dark` (#8a6a2e) is only for `:hover`/`:active` on gold-filled buttons; never use it as a standalone text color.

### 1.3 Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Headings (EN) | `Playfair Display` | 400, 700 | Scholarly serif, from Google Fonts |
| Body (EN) | `Inter` | 400, 500, 600 | Neutral, readable |
| Hebrew text | `Noto Sans Hebrew` | 400, 700 | RTL, Unicode compliant |
| Mono / code | `JetBrains Mono` | 400 | Code blocks, API examples |

### 1.4 Iconography
- Library: Lucide React (consistent with shadcn/ui)
- Hebrew decorative elements: thin geometric borders inspired by Temple architecture motifs
- No stock Torah clipart — use abstract sacred geometry if decorative elements needed

---

## 2. Page Inventory

| Route | Type | Auth | Purpose |
|---|---|---|---|
| `/` | Marketing | No | Homepage / landing |
| `/about` | Marketing | No | Mission, team, story |
| `/pricing` | Marketing | No | Plans and features |
| `/signin` | Auth | No | Sign in |
| `/signup` | Auth | No | Create account |
| `/dashboard` | App | Yes | User home |
| `/study` | App | Yes | AI Study Partner |
| `/study/[id]` | App | Yes | Saved session |
| `/search` | App | Yes | Semantic Torah search |
| `/community` | App | Yes | Discourse embed + Discord |
| `/marketplace` | App | Yes | Browse listings |
| `/marketplace/[slug]` | App | Yes | Product detail |
| `/marketplace/sell` | App | Creator | Submit listing |
| `/events` | Content | No | Events list |
| `/events/[slug]` | Content | No | Event detail |
| `/blog` | Content | No | Blog index |
| `/blog/[slug]` | Content | No | Blog post |
| `/apps` | Content | No | App directory |
| `/apps/[slug]` | Content | No | App detail |
| `/resources` | Content | No | Resource library |
| `/resources/[slug]` | Content | No | Resource page |
| `/studio` | Admin | Admin | Sanity Studio |

---

## 3. Page Designs

### 3.1 Homepage (`/`)

**Layout: Full-width, section-stacked**

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR: Logo | Study | Apps | Blog | Community | Sign In │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  HERO SECTION                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [Background: dark navy with subtle Star of David  │  │
│  │   geometric pattern, gold accents]                 │  │
│  │                                                    │  │
│  │  Explore Torah Through Artificial Intelligence     │  │
│  │  [Playfair Display, 56px, white]                   │  │
│  │                                                    │  │
│  │  A living community of scholars and developers     │  │
│  │  building AI tools rooted in authentic tradition.  │  │
│  │  [Inter, 20px, white 80%]                          │  │
│  │                                                    │  │
│  │  [Start Studying]  [Explore Apps]                  │  │
│  │  gold CTA          outline CTA                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  FEATURE STRIP (3 columns)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ AI Study │  │ Semantic │  │Community │               │
│  │ Partner  │  │ Search   │  │ & Forum  │               │
│  │ icon+txt │  │ icon+txt │  │ icon+txt │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│  HOW IT WORKS (alternating image/text)                   │
│  1. Ask a question → 2. AI finds sources → 3. Study      │
│                                                          │
│  FEATURED APPS (3 cards from Sanity)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ App card │  │ App card │  │ App card │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                  [View All Apps →]       │
│                                                          │
│  UPCOMING EVENTS (horizontal scroll on mobile)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │EventCard │  │EventCard │  │EventCard │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│  LATEST BLOG POSTS (3 cards)                             │
│                                                          │
│  JOIN CTA (navy background, gold text)                   │
│  "Join the community building AI for Torah"              │
│  [Create Account]                                        │
│                                                          │
│  FOOTER                                                  │
│  Logo | Links | Social | Copyright                       │
└──────────────────────────────────────────────────────────┘
```

---

### 3.2 AI Study Partner (`/study`)

**Layout: Two-pane (sidebar + chat)**

```
┌───────────────────────────────────────────────────────┐
│  APP SIDEBAR          │  MAIN CONTENT                 │
│  ─────────────────    │  ───────────────────────────  │
│  [Logo]               │  AI Study Partner             │
│                       │                               │
│  ○ Study (active)     │  ┌───────────────────────┐    │
│  ○ Search             │  │  CHAT HISTORY LIST     │    │
│  ○ Community          │  │  [+ New Session]       │    │
│  ○ Marketplace        │  │  > "Business ethics"   │    │
│  ○ Events             │  │    Yesterday           │    │
│                       │  │  > "Shabbat laws"      │    │
│  ──────────────       │  │    2 days ago          │    │
│  [User Avatar]        │  └───────────────────────┘    │
│  Settings / Logout    │                               │
│                       │  ACTIVE CHAT AREA             │
│                       │  ┌───────────────────────┐    │
│                       │  │  [AI] Hello! What      │    │
│                       │  │  would you like to     │    │
│                       │  │  study today?          │    │
│                       │  │                        │    │
│                       │  │  [USER] What does the  │    │
│                       │  │  Talmud say about      │    │
│                       │  │  honesty in business?  │    │
│                       │  │                        │    │
│                       │  │  [AI] ▌ (streaming)    │    │
│                       │  │  "The Talmud addresses │    │
│                       │  │  business ethics..."   │    │
│                       │  │                        │    │
│                       │  │  ▼ Sources (3)         │    │
│                       │  │  ┌─────────────────┐   │    │
│                       │  │  │ Bava Metzia 49a  │   │    │
│                       │  │  │ Hebrew / English │   │    │
│                       │  │  └─────────────────┘   │    │
│                       │  └───────────────────────┘    │
│                       │                               │
│                       │  ┌───────────────────────┐    │
│                       │  │  Ask about any Torah   │    │
│                       │  │  text or topic...  [↑] │    │
│                       │  └───────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

**Message bubble styles:**
- User: right-aligned, `--primary` background, white text
- Assistant: left-aligned, white card with `--border` border, navy text
- Torah quote inside response: styled block with gold left border, Hebrew RTL above English

---

### 3.3 Semantic Torah Search (`/search`)

```
┌──────────────────────────────────────────────────┐
│  SIDEBAR  │  Search the Torah Corpus             │
│           │                                      │
│           │  ┌────────────────────────────────┐  │
│           │  │  "What does Torah say about..." │  │
│           │  │  [Search]                       │  │
│           │  └────────────────────────────────┘  │
│           │                                      │
│           │  Filter: [All] [Tanakh] [Mishnah]    │
│           │          [Gemara] [Rishonim]         │
│           │                                      │
│           │  ─────────────────────────────────   │
│           │  Showing 12 results for "honesty"    │
│           │                                      │
│           │  ┌────────────────────────────────┐  │
│           │  │  Bava Metzia 49a          94%  │  │
│           │  │  ──────────────────────────     │  │
│           │  │  [Hebrew text, RTL]             │  │
│           │  │  "The seal of God is truth..."  │  │
│           │  │  [Ask Study Partner about this] │  │
│           │  └────────────────────────────────┘  │
│           │                                      │
│           │  ┌────────────────────────────────┐  │
│           │  │  Shabbat 55a              91%  │  │
│           │  │  ...                            │  │
│           │  └────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

### 3.4 App Directory (`/apps`)

**Grid layout with filter sidebar**

```
┌──────────────────────────────────────────────────────┐
│  PAGE HEADER                                         │
│  AI-Powered Jewish Apps                              │
│  Submit Your App [button]                            │
├──────────────┬───────────────────────────────────────┤
│  FILTERS     │  GRID (3 columns desktop, 1 mobile)   │
│              │                                       │
│  Search apps │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│              │  │[Logo]   │ │[Logo]   │ │[Logo]   │ │
│  Category    │  │App Name │ │App Name │ │App Name │ │
│  ○ All       │  │Tagline  │ │Tagline  │ │Tagline  │ │
│  ○ Study     │  │[Live]   │ │[OSS]    │ │[Beta]   │ │
│  ○ Halacha   │  └─────────┘ └─────────┘ └─────────┘ │
│  ○ Tools     │                                       │
│  ○ Data      │  [Load more]                          │
│              │                                       │
│  Status      │                                       │
│  □ Live      │                                       │
│  □ Beta      │                                       │
│  □ OSS       │                                       │
└──────────────┴───────────────────────────────────────┘
```

---

### 3.5 Navbar (Global)

**Marketing pages (unauthenticated):**
```
[AI Torah logo]    Study  Apps  Blog  Community  Events    [Sign In]  [Get Started →]
```

**App pages (authenticated):**
```
[AI Torah logo]  [sidebar toggle on mobile]    [Notification bell]  [Avatar + name ▾]
```

---

## 4. Component Specifications

### 4.1 BlogCard
```
┌────────────────────────────────┐
│  [Cover image 16:9]            │
│                                │
│  [Category badge] · Jan 5 2025 │
│  Post Title in Playfair        │
│  Excerpt text, 2 lines max,    │
│  truncated with ellipsis...    │
│                                │
│  [Author avatar] Author Name   │
└────────────────────────────────┘
```

### 4.2 TorahQuote (in blog/study)
```
┌──────────────────────────────────────┐
│ ▌ [Gold left border, cream bg]       │
│   בְּאָדָם                             │ (Hebrew, RTL, navy, 18px)
│   "In the beginning..."             │ (English, gray, 16px)
│   — Bereishit 1:1                   │ (Reference, small, accent gold)
└──────────────────────────────────────┘
```

### 4.3 EventCard
```
┌─────────────────────────────────┐
│  [Cover image]                  │
│                                 │
│  [Webinar] badge (color-coded)  │
│  Event Title                    │
│  Tue Jan 14 · 7:00 PM EST       │
│  Via Zoom                       │
│                                 │
│  [Register →]                   │
└─────────────────────────────────┘
```

---

## 5. Responsive Breakpoints

| Breakpoint | Width | Layout change |
|---|---|---|
| Mobile | < 768px | Single column, sidebar hidden (hamburger) |
| Tablet | 768–1024px | Two columns, sidebar collapses to icon bar |
| Desktop | > 1024px | Full three-column layout |
| Wide | > 1440px | Max-width 1400px centered |

---

## 6. Navigation Structure

```
AI Torah
│
├── (Public)
│   ├── Home
│   ├── About
│   ├── Pricing
│   ├── Blog
│   ├── App Directory
│   ├── Resources
│   └── Events
│
└── (Authenticated App)
    ├── Dashboard
    ├── Study (AI Study Partner)
    ├── Search (Torah Search)
    ├── Community
    │   ├── Forum (Discourse embed)
    │   └── Discord
    └── Marketplace
        ├── Browse
        └── My Listings (creators)
```

---

## 7. Key User Flows

### 7.1 New Visitor → Study Session
```
Land on Homepage
  → Read hero, click "Start Studying"
  → Redirected to /signin
  → Sign up with Google
  → Redirected to /study (empty state with suggested questions)
  → Type question → AI streams response → Citations shown
  → Session auto-saved
```

### 7.2 Developer → Submit App to Directory
```
Land on /apps
  → Click "Submit Your App"
  → Auth check (sign in if needed)
  → Form: name, tagline, URL, categories, description
  → Submitted to Sanity (draft status)
  → Admin reviews in Sanity Studio → publishes
  → /apps page revalidates via webhook
```

### 7.3 Creator → Publish Marketplace Listing
```
/marketplace/sell
  → Fill form: title, description, price, category
  → Stripe Connect onboarding (if first time)
  → Listing created (draft)
  → Admin approves → status → active
  → Visible on /marketplace
```

---

## 8. Accessibility Requirements

- WCAG 2.1 AA minimum
- All interactive elements keyboard-navigable
- Hebrew text has `lang="he"` and `dir="rtl"` attributes
- Color contrast ratio ≥ 4.5:1 for all body text
- All images have meaningful `alt` text
- Focus indicators visible in all themes
- Screen reader labels on icon-only buttons

---

## 9. Dark Mode

The site supports system dark mode via Tailwind's `dark:` variant.

| Light | Dark |
|---|---|
| Background `#fafaf8` | Background `#0f172a` |
| Surface `#ffffff` | Surface `#1e293b` |
| Text primary `#1a1a1a` | Text primary `#f1f5f9` |
| Primary `#1a3a5c` | Primary `#3b82f6` |
| Accent `#b5914a` | Accent `#f0d080` |
| Border `#e5e3db` | Border `#334155` |

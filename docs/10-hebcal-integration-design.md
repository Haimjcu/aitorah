# Hebcal Integration — Design Document

> Date: 2026-06-17
> Status: Draft
> Author: AI Torah team

---

## 1. Goal

Enable AI Torah's Study Partner to answer **calendar-aware Jewish questions** accurately — weekly parasha, daily learning schedules, Shabbat times, zmanim, Hebrew dates, and upcoming holidays — using the free [Hebcal REST APIs](https://www.hebcal.com/home/developer-apis) and, where beneficial, the `@hebcal/core` npm package for server-side computation.

The user should be able to ask natural-language questions like:
- "What is this week's parasha?"
- "What is the Daf Yomi for today?"
- "When does Shabbat start this Friday?"
- "What is the Hebrew date today?"
- "When is the next fast day?"
- "What time is sunrise tomorrow?" / "What are the zmanim for my location?"
- "Convert June 17 2026 to the Hebrew calendar"

And receive answers that are **location-aware** (Israel vs. Diaspora parasha differences, local candle-lighting times) without the user having to specify where they are.

---

## 2. Hebcal API Reference Summary

All Hebcal APIs are **free, no auth required**, licensed CC-BY-4.0. Rate limit: **90 requests per 10-second window**.

### 2.1 Jewish Calendar API

**Endpoint**: `GET https://www.hebcal.com/hebcal`

**Key parameters**:
| Param | Purpose | Example |
|---|---|---|
| `v=1` | Required version flag | `v=1` |
| `cfg=json` | JSON output | `cfg=json` |
| `start` / `end` | Date range (YYYY-MM-DD) | `start=2026-06-17&end=2026-06-24` |
| `year=now` | Current year shortcut | `year=now&month=x` |
| `s=on` | Parashat ha-Shavuah | includes leyning data |
| `i=on` | Israel schedule | vs. `i=off` for Diaspora |
| `maj=on` | Major holidays | |
| `min=on` | Minor holidays | |
| `mod=on` | Modern holidays | |
| `mf=on` | Minor fasts | |
| `ss=on` | Special Shabbatot | |
| `nx=on` | Rosh Chodesh | |
| `o=on` | Omer count | |
| `F=on` | Daf Yomi | |
| `myomi=on` | Mishna Yomi | |
| `yyomi=on` | Yerushalmi Yomi (Vilna) | |
| `dty=on` | Tanakh Yomi | |
| `dr1=on` | Rambam 1 chapter/day | |
| `dcc=on` | Chofetz Chaim daily | |
| `c=on` | Candle-lighting times (requires location) | |
| `b=18` | Minutes before sunset for candles | default 18 |
| `M=on` | Havdalah at tzeit (8.5°) | |
| `geo=geoname` | Location method | with `geonameid=<id>` |
| `zip=<code>` | US ZIP code location | |
| `lg=s` | Sephardic transliteration (default) | |

**Response**: `{ title, date, location, range, items: [{title, date, category, hebrew, leyning, memo, link, ...}] }`

**Categories**: `candles`, `havdalah`, `holiday`, `parashat`, `dafyomi`, `roshchodesh`, `zmanim`, and many more.

### 2.2 Shabbat Times API

**Endpoint**: `GET https://www.hebcal.com/shabbat`

**Key parameters**: `cfg=json`, location params, `b=<minutes>`, `M=on`, `gy/gm/gd` for specific date.

**Response**: Same structure as calendar API, scoped to the upcoming Shabbat. Includes `candles`, `parashat`, and `havdalah` items.

### 2.3 Zmanim API

**Endpoint**: `GET https://www.hebcal.com/zmanim`

**Key parameters**: `cfg=json`, location params, `date=YYYY-MM-DD` or `start`/`end`.

**Response**: `{ location, times: { alotHaShachar, misheyakir, dawn, sunrise, sofZmanShma, sofZmanShmaMGA, sofZmanTfilla, sofZmanTfillaMGA, chatzot, minchaGedola, minchaKetana, plagHaMincha, sunset, beinHaShmashos, dusk, tzeit7083deg, tzeit85deg, tzeit42min, tzeit50min, tzeit72min, chatzotNight, ... } }`

### 2.4 Hebrew Date Converter API

**Endpoint**: `GET https://www.hebcal.com/converter`

**Key parameters**:

*Gregorian → Hebrew*: `cfg=json&g2h=1&date=YYYY-MM-DD`
*Hebrew → Gregorian*: `cfg=json&h2g=1&hy=5786&hm=Sivan&hd=21`

**Response**: `{ gy, gm, gd, hy, hm, hd, hebrew, heDateParts: {y, m, d}, events: [...] }`

### 2.5 Location Parameters (Shared Across APIs)

All location-dependent APIs accept one of:
- `geonameid=<numeric>` — GeoNames.org ID (most precise, works worldwide)
- `zip=<code>` — US ZIP codes only
- `latitude=<lat>&longitude=<lon>&tzid=<tz>` — raw coordinates + timezone

Default candle-lighting offsets vary by location:
- Standard: 18 min before sunset
- Jerusalem: 40 min
- Haifa / Zikhron Ya'akov: 30 min

---

## 3. Architecture Overview

### 3.1 Where It Fits

```
User question
     │
     ▼
Intent Classifier (lib/rag/intent.ts)     ◄── EXTEND with calendar intent types
     │
     ├── type: "calendar" ──────────────► Hebcal Resolver (NEW: lib/hebcal/resolver.ts)
     │                                         │
     │                                    ┌────┼────────────────┐
     │                                    ▼    ▼                ▼
     │                              Calendar  Shabbat         Zmanim
     │                              API       Times API       API
     │                                    │    │                │
     │                                    └────┼────────────────┘
     │                                         ▼
     │                                   Formatted context string
     │                                         │
     ├── type: "date_conversion" ───────► Date Converter API ──┐
     │                                                         │
     ├── (existing types) ──────────────► Sefaria retrieval    │
     │                                         │               │
     └─────────────────────────────────────────┼───────────────┘
                                               ▼
                                    Claude answer generation
                                    (system prompt includes
                                     calendar context)
```

### 3.2 Decision: REST API vs. `@hebcal/core` npm package

| Consideration | REST API | `@hebcal/core` npm |
|---|---|---|
| No external HTTP call | No | Yes (server-side computation) |
| Zmanim calculation | Yes (full NOAA algorithm) | Yes (same algorithm) |
| Daily learning (Daf Yomi, etc.) | Yes (built-in) | Needs `@hebcal/learning` add-on |
| Candle-lighting with location | Yes | Yes, but needs manual `Location` setup |
| Parasha with leyning data | Yes (full aliyot) | Basic (needs `@hebcal/leyning` add-on) |
| Bundle size impact | None | ~174KB (or tree-shakeable) |
| Offline / no latency | No | Yes |
| Maintenance | Hebcal team maintains | Must update npm deps |

**Decision: Use the REST APIs as the primary data source.**

Rationale:
1. The REST APIs already compute everything we need (parasha, daily learning, zmanim, candle-lighting, date conversions) in a single call with location support.
2. We avoid adding `@hebcal/core` + `@hebcal/learning` + `@hebcal/leyning` to our bundle (and their `temporal-polyfill` dependency).
3. The REST APIs are well-cached by Hebcal's CDN; our own in-memory cache (like we do for Sefaria) adds another layer.
4. We can always add `@hebcal/core` later for offline/fallback if needed.

### 3.3 Caching Strategy

Hebcal data is date-specific and changes at most daily. We will reuse the same in-memory cache pattern from `lib/sefaria/client.ts`:

| API | Cache TTL | Key |
|---|---|---|
| Calendar (parasha, holidays, learning) | 6 hours | `hebcal:cal:{params_hash}` |
| Shabbat times | 6 hours | `hebcal:shabbat:{geonameid}:{date}` |
| Zmanim | 6 hours | `hebcal:zmanim:{geonameid}:{date}` |
| Date conversion | 24 hours | `hebcal:convert:{direction}:{date}` |

---

## 4. Detailed Design

### 4.1 New Files

```
lib/
├── hebcal/
│   ├── client.ts          # HTTP client for all Hebcal REST APIs (cached)
│   ├── types.ts           # TypeScript interfaces for Hebcal responses
│   ├── resolver.ts        # High-level resolver: intent → Hebcal API calls → context string
│   └── geo.ts             # IP geolocation → GeoNames ID resolution
```

### 4.2 `lib/hebcal/types.ts` — Hebcal Response Types

```typescript
export interface HebcalLocation {
  title: string
  city: string
  tzid: string
  latitude: number
  longitude: number
  cc: string          // country code (e.g. "US", "IL")
  country: string
  admin1?: string
  geonameid: number
  geo: string
}

export interface HebcalEvent {
  title: string
  date: string         // ISO 8601
  category: string     // candles | havdalah | holiday | parashat | dafyomi | ...
  subcat?: string      // major | minor | fast | modern
  hebrew: string
  hdate?: string       // Hebrew date string
  leyning?: HebcalLeyning
  memo?: string
  link?: string
  yomtov?: boolean
}

export interface HebcalLeyning {
  '1'?: string
  '2'?: string
  '3'?: string
  '4'?: string
  '5'?: string
  '6'?: string
  '7'?: string
  torah?: string
  haftarah?: string
  maftir?: string
  triennial?: Record<string, string>
}

export interface HebcalCalendarResponse {
  title: string
  date: string
  location?: HebcalLocation
  range: { start: string; end: string }
  items: HebcalEvent[]
}

export interface HebcalDateConversion {
  gy: number
  gm: number
  gd: number
  afterSunset: boolean
  hy: number
  hm: string
  hd: number
  hebrew: string       // Full Hebrew date with diacriticals (e.g. "כ״א בְּסִיוָן תשפ״ו")
  heDateParts: { y: string; m: string; d: string }
  events: string[]
}

export interface HebcalZmanimResponse {
  location: HebcalLocation
  times: HebcalZmanim
  date: string
}

export interface HebcalZmanim {
  chatzotNight: string | null
  alotHaShachar: string | null
  misheyakir: string | null
  misheyakirMachmir: string | null
  dawn: string | null
  sunrise: string | null
  sofZmanShma: string | null
  sofZmanShmaMGA: string | null
  sofZmanTfilla: string | null
  sofZmanTfillaMGA: string | null
  chatzot: string | null
  minchaGedola: string | null
  minchaKetana: string | null
  plagHaMincha: string | null
  sunset: string | null
  beinHaShmashos: string | null
  dusk: string | null
  tzeit7083deg: string | null
  tzeit85deg: string | null
  tzeit42min: string | null
  tzeit50min: string | null
  tzeit72min: string | null
}

export interface GeoInfo {
  geonameid: number
  city: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  timezone: string
  isIsrael: boolean
}
```

### 4.3 `lib/hebcal/geo.ts` — IP Geolocation

We need the user's location for two reasons:
1. **Israel vs. Diaspora** — determines which parasha is read (can differ by a week when a Diaspora second day of Yom Tov falls on Shabbat).
2. **Zmanim / candle-lighting times** — require latitude, longitude, and timezone.

**Strategy**: Use the request's IP address to get approximate location via a free geolocation service, then map to a GeoNames ID for Hebcal.

```typescript
// lib/hebcal/geo.ts

import { NextRequest } from 'next/server'

export interface GeoInfo {
  geonameid: number | null
  latitude: number
  longitude: number
  city: string
  country: string
  countryCode: string
  timezone: string
  isIsrael: boolean
}

const DEFAULT_GEO: GeoInfo = {
  geonameid: 5128581,     // New York City
  latitude: 40.7128,
  longitude: -74.006,
  city: 'New York',
  country: 'United States',
  countryCode: 'US',
  timezone: 'America/New_York',
  isIsrael: false,
}

const JERUSALEM_GEO: GeoInfo = {
  geonameid: 281184,
  latitude: 31.7683,
  longitude: 35.2137,
  city: 'Jerusalem',
  country: 'Israel',
  countryCode: 'IL',
  timezone: 'Asia/Jerusalem',
  isIsrael: true,
}

export function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

/**
 * Resolve user location from IP.
 * Uses ip-api.com free tier (no key needed, 45 req/min, non-commercial).
 * For production at scale, swap to a Railway-local MaxMind GeoLite2 DB
 * or Cloudflare headers (CF-IPCountry, CF-IPCity if available).
 */
export async function resolveGeo(req: NextRequest): Promise<GeoInfo> {
  const ip = getIP(req)

  // Localhost / private IPs → default
  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return DEFAULT_GEO
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon,timezone`,
      { next: { revalidate: 86400 } }   // cache 24h via Next.js fetch cache
    )
    const data = await res.json()

    if (data.status !== 'success') return DEFAULT_GEO

    const isIsrael = data.countryCode === 'IL'

    return {
      geonameid: null,  // ip-api doesn't return GeoNames ID; use lat/lon instead
      latitude: data.lat,
      longitude: data.lon,
      city: data.city ?? '',
      country: data.country ?? '',
      countryCode: data.countryCode ?? '',
      timezone: data.timezone ?? 'America/New_York',
      isIsrael,
    }
  } catch {
    return DEFAULT_GEO
  }
}

/** Build Hebcal location query params from GeoInfo */
export function geoToHebcalParams(geo: GeoInfo): string {
  if (geo.geonameid) {
    return `geo=geoname&geonameid=${geo.geonameid}`
  }
  return `latitude=${geo.latitude}&longitude=${geo.longitude}&tzid=${encodeURIComponent(geo.timezone)}`
}
```

**Production upgrade path**: When Railway sits behind Cloudflare, we can read `CF-IPCountry` and `CF-IPCity` headers directly — zero-latency, no external API call. Alternatively, use the GeoLite2 MaxMind database (`maxmind` npm package) for self-hosted lookups.

### 4.4 `lib/hebcal/client.ts` — Hebcal API Client

Follows the same pattern as `lib/sefaria/client.ts`: cached HTTP wrapper with typed methods.

```typescript
// lib/hebcal/client.ts

import type {
  HebcalCalendarResponse,
  HebcalDateConversion,
  HebcalZmanimResponse,
  GeoInfo,
} from './types'
import { geoToHebcalParams } from './geo'

const BASE_URL = 'https://www.hebcal.com'

// Reuse same in-memory cache pattern as lib/sefaria/client.ts
const cache = new Map<string, { data: unknown; expires: number }>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) { cache.delete(key); return null }
  return entry.data as T
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs })
  if (cache.size > 500) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

async function fetchHebcal<T>(path: string, ttlMs = 21600_000): Promise<T> {
  const cacheKey = `hebcal:${path}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Hebcal API error: ${res.status} for ${path}`)
  }
  const data = await res.json()
  setCache(cacheKey, data, ttlMs)
  return data as T
}

/**
 * Get calendar events for a date range.
 * Includes: parasha, holidays, daily learning, candle-lighting.
 */
export async function getCalendarEvents(
  startDate: string,         // YYYY-MM-DD
  endDate: string,           // YYYY-MM-DD
  geo: GeoInfo | null,
  opts?: {
    parasha?: boolean        // default true
    holidays?: boolean       // default true
    dailyLearning?: boolean  // default true
    candleLighting?: boolean // default true (needs geo)
  }
): Promise<HebcalCalendarResponse> {
  const o = { parasha: true, holidays: true, dailyLearning: true, candleLighting: true, ...opts }

  const params = new URLSearchParams({
    v: '1',
    cfg: 'json',
    start: startDate,
    end: endDate,
  })

  if (o.parasha)  params.set('s', 'on')
  if (o.holidays) {
    params.set('maj', 'on')
    params.set('min', 'on')
    params.set('mod', 'on')
    params.set('mf', 'on')
    params.set('ss', 'on')
    params.set('nx', 'on')
    params.set('o', 'on')
  }
  if (o.dailyLearning) {
    params.set('F', 'on')     // Daf Yomi
    params.set('myomi', 'on') // Mishna Yomi
    params.set('yyomi', 'on') // Yerushalmi Yomi
    params.set('dty', 'on')   // Tanakh Yomi
    params.set('dr1', 'on')   // Rambam 1/day
  }
  if (geo) {
    params.set('i', geo.isIsrael ? 'on' : 'off')
    if (o.candleLighting) {
      params.set('c', 'on')
      params.set('M', 'on')
    }
    const locParams = new URLSearchParams(geoToHebcalParams(geo))
    locParams.forEach((v, k) => params.set(k, v))
  }

  return fetchHebcal<HebcalCalendarResponse>(`/hebcal?${params}`)
}

/** Get this week's Shabbat info (parasha, candle-lighting, havdalah). */
export async function getShabbatTimes(
  geo: GeoInfo
): Promise<HebcalCalendarResponse> {
  const params = new URLSearchParams({
    cfg: 'json',
    M: 'on',
    leyning: 'on',
  })
  params.set('i', geo.isIsrael ? 'on' : 'off')
  const locParams = new URLSearchParams(geoToHebcalParams(geo))
  locParams.forEach((v, k) => params.set(k, v))

  return fetchHebcal<HebcalCalendarResponse>(`/shabbat?${params}`)
}

/** Get halachic times (zmanim) for a specific date and location. */
export async function getZmanim(
  date: string,              // YYYY-MM-DD
  geo: GeoInfo
): Promise<HebcalZmanimResponse> {
  const params = new URLSearchParams({ cfg: 'json', date })
  const locParams = new URLSearchParams(geoToHebcalParams(geo))
  locParams.forEach((v, k) => params.set(k, v))

  return fetchHebcal<HebcalZmanimResponse>(`/zmanim?${params}`)
}

/** Convert Gregorian date to Hebrew date. */
export async function gregorianToHebrew(
  date: string               // YYYY-MM-DD
): Promise<HebcalDateConversion> {
  return fetchHebcal<HebcalDateConversion>(
    `/converter?cfg=json&g2h=1&date=${date}&strict=1`,
    86400_000  // 24h cache
  )
}

/** Convert Hebrew date to Gregorian date. */
export async function hebrewToGregorian(
  hy: number,
  hm: string,                // e.g. "Sivan", "Tishrei"
  hd: number
): Promise<HebcalDateConversion> {
  return fetchHebcal<HebcalDateConversion>(
    `/converter?cfg=json&h2g=1&hy=${hy}&hm=${encodeURIComponent(hm)}&hd=${hd}&strict=1`,
    86400_000
  )
}
```

### 4.5 Extend the Intent Classifier

Add new intent types to `lib/rag/intent.ts`:

**New IntentType values**:
- `calendar_parasha` — "What is this week's parasha?"
- `calendar_learning` — "What is the Daf Yomi today?"
- `calendar_shabbat` — "When does Shabbat start?", "Candle lighting times"
- `calendar_zmanim` — "What time is sunrise?", "When is mincha ketana?"
- `calendar_holiday` — "When is the next holiday?", "When is Chanukah?"
- `calendar_date` — "What is today's Hebrew date?", "Convert June 17 to Hebrew"
- `calendar_general` — Catch-all for other calendar questions

**Updated INTENT_PROMPT** (additions to the existing prompt):

```
Add to the "type" enum:
  "calendar_parasha" | "calendar_learning" | "calendar_shabbat" |
  "calendar_zmanim" | "calendar_holiday" | "calendar_date" | "calendar_general"

Add a new field:
  "calendar_params": {
    "needs_location": boolean,        // true for zmanim, shabbat times, parasha (Israel/Diaspora)
    "date_reference": string | null,  // "today", "this_week", "tomorrow", "2026-06-17", etc.
    "hebrew_date": {                  // for date conversion
      "hy": number | null,
      "hm": string | null,
      "hd": number | null
    } | null,
    "gregorian_date": string | null,  // YYYY-MM-DD for conversion
    "learning_type": string | null    // "daf_yomi", "mishna_yomi", "yerushalmi_yomi", etc.
  }

Guidelines for calendar types:
- "calendar_parasha": user asks about the weekly Torah portion, parashat hashavua, sedra
- "calendar_learning": user asks about Daf Yomi, Mishna Yomi, or any daily learning schedule
- "calendar_shabbat": user asks about candle lighting, havdalah, Shabbat start/end times
- "calendar_zmanim": user asks about sunrise, sunset, davening times, halachic times
- "calendar_holiday": user asks when a specific holiday falls, next fast day, upcoming events
- "calendar_date": user asks for Hebrew date conversion, "what is today's date in Hebrew"
- "calendar_general": general calendar questions not fitting above categories
- Any question about "this week", "today", "tomorrow" + Jewish observance → calendar type
- Parasha questions ALWAYS need location (Israel and Diaspora can differ)
```

**Updated ParsedIntent interface**:

```typescript
export interface CalendarParams {
  needs_location: boolean
  date_reference: string | null
  hebrew_date: { hy: number; hm: string; hd: number } | null
  gregorian_date: string | null
  learning_type: string | null
}

export interface ParsedIntent {
  type: IntentType          // extended with calendar_* types
  refs: string[]
  topics: string[]
  search_terms_en: string[]
  search_terms_he: string[]
  category_hint: string | null
  calendar_params: CalendarParams | null   // NEW — populated for calendar_* types
}
```

### 4.6 `lib/hebcal/resolver.ts` — Calendar Resolver

This is the core logic that translates a parsed calendar intent into Hebcal API calls and produces a formatted context string for Claude.

```typescript
// lib/hebcal/resolver.ts

import type { ParsedIntent } from '../rag/intent'
import type { GeoInfo } from './types'
import {
  getCalendarEvents,
  getShabbatTimes,
  getZmanim,
  gregorianToHebrew,
  hebrewToGregorian,
} from './client'

export interface CalendarContext {
  text: string           // Formatted text to inject into Claude's system prompt
  location?: string      // Human-readable location description
}

export async function resolveCalendar(
  intent: ParsedIntent,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  const today = new Date().toISOString().split('T')[0]   // YYYY-MM-DD
  const type = intent.type
  const cp = intent.calendar_params

  switch (type) {
    case 'calendar_parasha':
      return resolveParasha(geo)

    case 'calendar_learning':
      return resolveDailyLearning(today, geo, cp?.learning_type)

    case 'calendar_shabbat':
      return resolveShabbatTimes(geo)

    case 'calendar_zmanim':
      return resolveZmanim(cp?.date_reference ?? today, geo)

    case 'calendar_holiday':
      return resolveHolidays(today, geo)

    case 'calendar_date':
      return resolveDateConversion(cp, today)

    case 'calendar_general':
    default:
      return resolveGeneralCalendar(today, geo)
  }
}

async function resolveParasha(geo: GeoInfo | null): Promise<CalendarContext> {
  // Use Shabbat API — it returns this week's parasha automatically
  const defaultGeo = geo ?? { /* New York default */ } as GeoInfo
  const data = await getShabbatTimes(defaultGeo)

  const parashat = data.items.find(i => i.category === 'parashat')
  const candles = data.items.find(i => i.category === 'candles')
  const havdalah = data.items.find(i => i.category === 'havdalah')

  const parts: string[] = []
  parts.push(`[Calendar Data — This Week's Parasha]`)
  if (parashat) {
    parts.push(`Parashat ha-Shavuah: ${parashat.title} (${parashat.hebrew})`)
    if (parashat.leyning) {
      parts.push(`Torah reading: ${parashat.leyning.torah ?? 'N/A'}`)
      parts.push(`Haftarah: ${parashat.leyning.haftarah ?? 'N/A'}`)
    }
    if (parashat.link) parts.push(`More info: ${parashat.link}`)
  }
  if (geo?.isIsrael) {
    parts.push(`Schedule: Israel`)
  } else {
    parts.push(`Schedule: Diaspora`)
  }
  if (candles) parts.push(`Candle lighting: ${candles.title} (${candles.date})`)
  if (havdalah) parts.push(`Havdalah: ${havdalah.title} (${havdalah.date})`)

  const location = geo ? `${geo.city}, ${geo.country}` : 'New York, US (default)'
  parts.push(`Location: ${location}`)

  return { text: parts.join('\n'), location }
}

async function resolveDailyLearning(
  today: string,
  geo: GeoInfo | null,
  learningType: string | null
): Promise<CalendarContext> {
  const data = await getCalendarEvents(today, today, geo, {
    parasha: false,
    holidays: false,
    dailyLearning: true,
    candleLighting: false,
  })

  const learningItems = data.items.filter(i =>
    ['dafyomi', 'mishnayomi', 'yerushalmi', 'tanakhyomi', 'rambam1'].includes(i.category)
  )

  const parts = [`[Calendar Data — Daily Learning for ${today}]`]
  for (const item of learningItems) {
    parts.push(`${item.title} (${item.hebrew ?? ''})`)
    if (item.memo) parts.push(`  ${item.memo}`)
  }
  if (learningItems.length === 0) {
    parts.push('No daily learning data available for this date.')
  }

  return { text: parts.join('\n') }
}

async function resolveShabbatTimes(geo: GeoInfo | null): Promise<CalendarContext> {
  if (!geo) {
    return {
      text: '[Calendar Data — Shabbat Times]\nLocation unknown. Cannot provide specific Shabbat times without a location. The user can provide their city or ZIP code for accurate times.',
    }
  }

  const data = await getShabbatTimes(geo)
  const parts = [`[Calendar Data — Shabbat Times for ${geo.city}, ${geo.country}]`]

  for (const item of data.items) {
    if (item.category === 'candles') {
      parts.push(`Candle lighting: ${item.title} — ${formatTime(item.date)}`)
    } else if (item.category === 'havdalah') {
      parts.push(`Havdalah: ${item.title} — ${formatTime(item.date)}`)
    } else if (item.category === 'parashat') {
      parts.push(`Parasha: ${item.title} (${item.hebrew})`)
    }
  }

  return { text: parts.join('\n'), location: `${geo.city}, ${geo.country}` }
}

async function resolveZmanim(
  dateRef: string,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  if (!geo) {
    return {
      text: '[Calendar Data — Zmanim]\nLocation unknown. Cannot provide halachic times without a location.',
    }
  }

  const date = resolveDateReference(dateRef)
  const data = await getZmanim(date, geo)

  const parts = [`[Calendar Data — Zmanim for ${date} in ${geo.city}, ${geo.country}]`]

  const labels: Record<string, string> = {
    alotHaShachar: 'Alot HaShachar (Dawn)',
    misheyakir: 'Misheyakir (Earliest Tallit/Tefillin)',
    sunrise: 'Netz HaChama (Sunrise)',
    sofZmanShma: "Sof Zman Shma (GR\"A)",
    sofZmanShmaMGA: "Sof Zman Shma (MG\"A)",
    sofZmanTfilla: "Sof Zman Tefillah (GR\"A)",
    sofZmanTfillaMGA: "Sof Zman Tefillah (MG\"A)",
    chatzot: 'Chatzot (Midday)',
    minchaGedola: 'Mincha Gedola',
    minchaKetana: 'Mincha Ketana',
    plagHaMincha: 'Plag HaMincha',
    sunset: "Shkiah (Sunset)",
    beinHaShmashos: 'Bein HaShmashot',
    tzeit7083deg: 'Tzeit HaKochavim (7.083°)',
    tzeit85deg: 'Tzeit HaKochavim (8.5°)',
  }

  for (const [key, label] of Object.entries(labels)) {
    const val = data.times[key as keyof typeof data.times]
    if (val) parts.push(`${label}: ${formatTime(val)}`)
  }

  return { text: parts.join('\n'), location: `${geo.city}, ${geo.country}` }
}

async function resolveHolidays(
  today: string,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  // Look ahead 90 days for upcoming holidays
  const end = new Date(today)
  end.setDate(end.getDate() + 90)
  const endStr = end.toISOString().split('T')[0]

  const data = await getCalendarEvents(today, endStr, geo, {
    parasha: false,
    holidays: true,
    dailyLearning: false,
    candleLighting: false,
  })

  const holidays = data.items.filter(i =>
    i.category === 'holiday' || i.category === 'roshchodesh'
  )

  const parts = [`[Calendar Data — Upcoming Holidays from ${today}]`]
  for (const h of holidays.slice(0, 20)) {
    const extra = h.subcat ? ` (${h.subcat})` : ''
    parts.push(`${h.date.split('T')[0]} — ${h.title}${extra} (${h.hebrew})`)
    if (h.memo) parts.push(`  ${h.memo}`)
  }

  return { text: parts.join('\n') }
}

async function resolveDateConversion(
  cp: ParsedIntent['calendar_params'],
  today: string
): Promise<CalendarContext> {
  const parts: string[] = []

  // Hebrew → Gregorian
  if (cp?.hebrew_date?.hy && cp.hebrew_date.hm && cp.hebrew_date.hd) {
    const result = await hebrewToGregorian(
      cp.hebrew_date.hy, cp.hebrew_date.hm, cp.hebrew_date.hd
    )
    parts.push(`[Calendar Data — Hebrew Date Conversion]`)
    parts.push(`Hebrew: ${result.hebrew} (${result.hd} ${result.hm} ${result.hy})`)
    parts.push(`Gregorian: ${result.gy}-${String(result.gm).padStart(2,'0')}-${String(result.gd).padStart(2,'0')}`)
    if (result.events.length > 0) parts.push(`Events: ${result.events.join(', ')}`)
    return { text: parts.join('\n') }
  }

  // Gregorian → Hebrew (specific date or today)
  const date = cp?.gregorian_date ?? today
  const result = await gregorianToHebrew(date)
  parts.push(`[Calendar Data — Hebrew Date Conversion]`)
  parts.push(`Gregorian: ${result.gy}-${String(result.gm).padStart(2,'0')}-${String(result.gd).padStart(2,'0')}`)
  parts.push(`Hebrew: ${result.hebrew}`)
  parts.push(`Hebrew date parts: ${result.heDateParts.d} ${result.heDateParts.m} ${result.heDateParts.y}`)
  if (result.events.length > 0) parts.push(`Events on this date: ${result.events.join(', ')}`)

  return { text: parts.join('\n') }
}

async function resolveGeneralCalendar(
  today: string,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  // Return a broad context: today's Hebrew date + this week's events
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [dateConv, events] = await Promise.allSettled([
    gregorianToHebrew(today),
    getCalendarEvents(today, weekEnd.toISOString().split('T')[0], geo),
  ])

  const parts = [`[Calendar Data — This Week (${today})]`]

  if (dateConv.status === 'fulfilled') {
    parts.push(`Today's Hebrew date: ${dateConv.value.hebrew}`)
  }

  if (events.status === 'fulfilled') {
    for (const item of events.value.items.slice(0, 15)) {
      parts.push(`${item.date.split('T')[0]} — ${item.title} [${item.category}]`)
    }
  }

  return { text: parts.join('\n') }
}

// Helpers

function formatTime(isoOrTime: string): string {
  try {
    const d = new Date(isoOrTime)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return isoOrTime
  }
}

function resolveDateReference(ref: string): string {
  const today = new Date()
  if (ref === 'today' || !ref) return today.toISOString().split('T')[0]
  if (ref === 'tomorrow') {
    today.setDate(today.getDate() + 1)
    return today.toISOString().split('T')[0]
  }
  // Assume it's already YYYY-MM-DD
  return ref
}
```

### 4.7 Integration into the Chat Pipeline

**Changes to `app/api/chat/route.ts`**:

```typescript
// After intent classification, before Sefaria retrieval:

import { resolveCalendar } from '@/lib/hebcal/resolver'
import { resolveGeo } from '@/lib/hebcal/geo'

// Inside POST handler, after classifyIntent():

let calendarContext = ''
if (intent.type.startsWith('calendar_')) {
  const geo = intent.calendar_params?.needs_location
    ? await resolveGeo(req)
    : null
  const calResult = await resolveCalendar(intent, geo)
  calendarContext = calResult.text
}
```

**Changes to `lib/ai/prompts.ts`**:

```typescript
export function buildStudyPartnerSystemPrompt(
  passages: string,
  calendarContext?: string
): string {
  let calendarBlock = ''
  if (calendarContext) {
    calendarBlock = `

CALENDAR AND SCHEDULE DATA:
The following data was retrieved from Hebcal (hebcal.com) for the user's current date and location.
Use this data to answer calendar-related questions accurately. When citing times, always mention
the location they apply to. When discussing the parasha, note whether Israel or Diaspora schedule
is being used if it matters.

${calendarContext}
`
  }

  return `You are a learned Torah study partner...

INSTRUCTIONS:
... (existing instructions) ...
- For calendar questions (parasha, zmanim, holidays, daily learning), use the CALENDAR DATA provided below. Do not guess dates or times.
- When providing zmanim or Shabbat times, always state the location they apply to.
- When discussing the weekly parasha, if the Israel and Diaspora readings differ, mention both if relevant.
${calendarBlock}

RETRIEVED SOURCE PASSAGES:
${passages}

Answer the user's question...`
}
```

### 4.8 Handling the Hybrid Case

Many questions blend calendar and textual content. For example:
- "What is this week's parasha about?" — needs both the parasha name (Hebcal) and the text/commentary (Sefaria).
- "What does Rashi say about this week's parasha?" — needs parasha name → resolve to Sefaria ref → fetch commentary.

**Strategy**: For `calendar_parasha` intents, after resolving the parasha name from Hebcal, inject the parasha name as a Sefaria ref into the existing retrieval pipeline:

```typescript
// In the chat route, after resolving calendar context:
if (intent.type === 'calendar_parasha' && calResult.parashaRef) {
  // Add the parasha ref to the intent for Sefaria retrieval
  intent.refs.push(calResult.parashaRef)  // e.g., "Parashat Korach" → "Numbers 16:1-18:32"
}
```

The `resolveParasha()` function should also return the Torah reading reference from the leyning data so it can be mapped to a Sefaria ref for text retrieval.

---

## 5. User-Location Flow

```
User asks "What time does Shabbat start?"
     │
     ▼
1. Intent classifier → type: "calendar_shabbat"
                        calendar_params.needs_location: true
     │
     ▼
2. resolveGeo(req)
   ├── Extract IP from x-forwarded-for header
   ├── Call ip-api.com → get lat/lon/timezone/country
   ├── Set isIsrael = (countryCode === "IL")
   └── Return GeoInfo { lat, lon, timezone, city, country, isIsrael }
     │
     ▼
3. getShabbatTimes(geo)
   ├── Build URL: /shabbat?cfg=json&latitude=...&longitude=...&tzid=...&M=on&i=off
   └── Return items: [candles, parashat, havdalah]
     │
     ▼
4. Format context string:
   "Candle lighting: Friday, June 19, 2026 at 8:12 PM
    Parasha: Korach (קֹרַח)
    Havdalah: Saturday, June 20, 2026 at 9:17 PM
    Location: New York, United States"
     │
     ▼
5. Inject into Claude system prompt → generate answer
```

---

## 6. Example Interactions

### "What is this week's parasha?"

1. Intent: `calendar_parasha`, `needs_location: true`
2. Geo: New York (Diaspora) → `i=off`
3. Hebcal `/shabbat` → Parashat Korach, leyning: Numbers 16:1-18:32, Haftarah: I Samuel 11:14-12:22
4. Also fetch Sefaria text for Numbers 16:1 (first aliyah) for context
5. Claude answers with parasha name, summary, Torah reading details, and Sefaria source citations

### "What is the Daf Yomi for today?"

1. Intent: `calendar_learning`, `learning_type: "daf_yomi"`
2. Hebcal `/hebcal?start=2026-06-17&end=2026-06-17&F=on` → "Bava Kamma 42"
3. Claude answers: "Today's Daf Yomi is Bava Kamma 42..." with context from Sefaria if available

### "When does Shabbat end this week?"

1. Intent: `calendar_shabbat`, `needs_location: true`
2. Geo resolved from IP → Jerusalem, Israel
3. Hebcal `/shabbat?...&geonameid=281184` → Havdalah at 8:42 PM
4. Claude: "In Jerusalem, Shabbat ends this Saturday at 8:42 PM (tzeit hakochavim, 8.5° below the horizon)."

### "What is today's Hebrew date?"

1. Intent: `calendar_date`, `gregorian_date: "2026-06-17"`
2. Hebcal `/converter?cfg=json&g2h=1&date=2026-06-17` → כ״א בְּסִיוָן תשפ״ו (21 Sivan 5786)
3. Claude: "Today is the 21st of Sivan, 5786 (כ״א בְּסִיוָן תשפ״ו)."

### "Convert 15 Tishrei 5787 to the Gregorian calendar"

1. Intent: `calendar_date`, `hebrew_date: {hy: 5787, hm: "Tishrei", hd: 15}`
2. Hebcal `/converter?cfg=json&h2g=1&hy=5787&hm=Tishrei&hd=15` → October 3, 2026
3. Claude: "15 Tishrei 5787 corresponds to Saturday, October 3, 2026 — the first day of Sukkot."

### "What time is sunrise tomorrow?"

1. Intent: `calendar_zmanim`, `date_reference: "tomorrow"`, `needs_location: true`
2. Geo → user's location
3. Hebcal `/zmanim?date=2026-06-18&latitude=...&longitude=...`
4. Claude: "Tomorrow (June 18, 2026), sunrise (Netz HaChama) in [city] is at 5:25 AM."

---

## 7. Error Handling & Graceful Degradation

| Failure | Behavior |
|---|---|
| IP geolocation fails | Use New York (Diaspora) as default. Mention in response: "I'm using New York times as a default — let me know your city for more accurate results." |
| Hebcal API down / rate limited | Fall back to Claude's general knowledge. Prefix with: "I wasn't able to fetch live calendar data, so this is based on my general knowledge — please verify." |
| User in Israel but IP resolves to US (VPN) | Answer with Diaspora schedule. User can correct by saying "I'm in Israel" — intent classifier should note location override. |
| Ambiguous date ("next Shabbat" in different timezones) | Use the timezone from geo resolution. Always show the timezone in the response. |

---

## 8. Implementation Plan

### Phase 1 — Core calendar (MVP)
1. Create `lib/hebcal/types.ts` — type definitions
2. Create `lib/hebcal/client.ts` — cached HTTP client for all 4 APIs
3. Create `lib/hebcal/geo.ts` — IP geolocation with default fallback
4. Create `lib/hebcal/resolver.ts` — intent → API calls → context string
5. Extend `lib/rag/intent.ts` — add `calendar_*` types and `calendar_params` field
6. Update `lib/ai/prompts.ts` — add calendar context block to system prompt
7. Update `app/api/chat/route.ts` — wire calendar resolution into the pipeline

### Phase 2 — Hybrid parasha+text
8. Map Hebcal parasha leyning references to Sefaria refs
9. Auto-fetch Sefaria text for the current parasha when asked "what is this week's parasha about?"

### Phase 3 — User location refinement
10. Support explicit location in chat: "I'm in Jerusalem" / "zmanim for Chicago"
11. Parse city names in the intent classifier → map to GeoNames IDs
12. Optionally use browser Geolocation API (with permission) for precise location on the frontend

### Phase 4 — Enrichment
13. Add Leyning API integration for full Torah reading details (aliyot breakdown)
14. Add upcoming Yahrzeits/birthdays if the user has saved Hebrew dates
15. Consider `@hebcal/core` for server-side offline fallback

---

## 9. Rate Limiting & Performance

- **Hebcal rate limit**: 90 requests per 10 seconds. With our 6-hour in-memory cache, typical usage will hit Hebcal only once per unique (date, location) combination per 6 hours. At scale, consider a shared Redis cache (we already have Upstash) to avoid redundant calls across server instances.
- **ip-api.com rate limit**: 45 requests per minute (free tier, non-commercial). For production scale, switch to MaxMind GeoLite2 (free, self-hosted, no rate limit) or Cloudflare headers.
- **Latency**: Hebcal API responses are typically 50-150ms. The geo lookup adds ~100ms. Total overhead for a calendar question: ~200-300ms on cache miss, ~0ms on cache hit. This runs in parallel with (or instead of) Sefaria retrieval, so it doesn't add to the critical path for most questions.

---

## 10. Files Changed Summary

| File | Change |
|---|---|
| `lib/hebcal/types.ts` | **NEW** — TypeScript interfaces for all Hebcal responses |
| `lib/hebcal/client.ts` | **NEW** — Cached HTTP client for 4 Hebcal APIs |
| `lib/hebcal/geo.ts` | **NEW** — IP geolocation → GeoInfo resolution |
| `lib/hebcal/resolver.ts` | **NEW** — Calendar intent → API calls → context string |
| `lib/rag/intent.ts` | **MODIFY** — Add 7 calendar intent types + `calendar_params` |
| `lib/ai/prompts.ts` | **MODIFY** — Accept optional calendar context, add instructions |
| `app/api/chat/route.ts` | **MODIFY** — Wire in calendar resolution before answer generation |
| `package.json` | No changes needed (all Hebcal interaction via REST) |

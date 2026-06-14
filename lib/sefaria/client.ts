import type {
  SefariaTextResponse,
  SefariaSearchResponse,
  SefariaSearchHit,
  SefariaLink,
  SefariaTopic,
  SefariaRelatedResponse,
  SefariaNameMatch,
  SefariaCalendarItem,
} from './types'

const BASE_URL = 'https://www.sefaria.org'

const cache = new Map<string, { data: unknown; expires: number }>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs })
  if (cache.size > 500) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

async function fetchSefaria<T>(path: string, options?: RequestInit & { ttlMs?: number }): Promise<T> {
  const ttl = options?.ttlMs ?? 3600_000
  const cacheKey = `${options?.method ?? 'GET'}:${path}:${options?.body ?? ''}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`Sefaria API error: ${res.status} ${res.statusText} for ${path}`)
  }

  const data = await res.json()
  setCache(cacheKey, data, ttl)
  return data as T
}

export async function getTexts(
  ref: string,
  opts?: { version?: string; returnFormat?: string }
): Promise<SefariaTextResponse> {
  const params = new URLSearchParams()
  if (opts?.version) params.set('version', opts.version)
  params.set('return_format', opts?.returnFormat ?? 'text_only')
  const qs = params.toString()
  return fetchSefaria<SefariaTextResponse>(`/api/v3/texts/${encodeURIComponent(ref)}?${qs}`, {
    ttlMs: 86400_000,
  })
}

export async function searchTexts(
  query: string,
  opts?: { size?: number; slop?: number; field?: string; categoryPath?: string }
): Promise<SefariaSearchResponse> {
  const size = opts?.size ?? 10
  const field = opts?.field ?? 'naive_lemmatizer'
  const slop = opts?.slop ?? 1

  const esQuery: Record<string, unknown> = {
    match_phrase: {
      [field]: { query, slop },
    },
  }

  const body: Record<string, unknown> = {
    from: 0,
    size,
    highlight: {
      pre_tags: ['<b>'],
      post_tags: ['</b>'],
      fields: { [field]: {} },
    },
    query: {
      function_score: {
        field_value_factor: { field: 'pagesheetrank', missing: 0.04 },
        query: opts?.categoryPath
          ? {
              bool: {
                must: esQuery,
                filter: { bool: { should: [{ regexp: { path: `${opts.categoryPath}.*` } }] } },
              },
            }
          : esQuery,
      },
    },
  }

  return fetchSefaria<SefariaSearchResponse>('/api/search/text/_search', {
    method: 'POST',
    body: JSON.stringify(body),
    ttlMs: 3600_000,
  })
}

export async function searchExact(query: string, size = 5): Promise<SefariaSearchResponse> {
  return searchTexts(query, { field: 'exact', size, slop: 0 })
}

export async function getLinks(ref: string, withText = true): Promise<SefariaLink[]> {
  const params = new URLSearchParams({ with_text: withText ? '1' : '0' })
  return fetchSefaria<SefariaLink[]>(`/api/links/${encodeURIComponent(ref)}?${params}`, {
    ttlMs: 86400_000,
  })
}

export async function getRelated(ref: string): Promise<SefariaRelatedResponse> {
  return fetchSefaria<SefariaRelatedResponse>(`/api/related/${encodeURIComponent(ref)}`, {
    ttlMs: 86400_000,
  })
}

export async function getTopic(
  slug: string,
  opts?: { withRefs?: boolean; withLinks?: boolean }
): Promise<SefariaTopic> {
  const params = new URLSearchParams()
  if (opts?.withRefs) params.set('with_refs', '1')
  if (opts?.withLinks) params.set('with_links', '1')
  params.set('annotate_links', '1')
  const qs = params.toString()
  return fetchSefaria<SefariaTopic>(`/api/topics/${encodeURIComponent(slug)}?${qs}`, {
    ttlMs: 86400_000,
  })
}

export async function autocomplete(name: string, limit = 10): Promise<SefariaNameMatch> {
  return fetchSefaria<SefariaNameMatch>(
    `/api/name/${encodeURIComponent(name)}?limit=${limit}`,
    { ttlMs: 3600_000 }
  )
}

export async function getCalendars(): Promise<{ calendar_items: SefariaCalendarItem[] }> {
  return fetchSefaria<{ calendar_items: SefariaCalendarItem[] }>('/api/calendars', {
    ttlMs: 3600_000,
  })
}

export async function recommendTopics(refs: string[]): Promise<SefariaTopic[]> {
  const joined = refs.map(encodeURIComponent).join('+')
  return fetchSefaria<SefariaTopic[]>(`/api/recommend/topics/${joined}`, {
    ttlMs: 3600_000,
  })
}

export function flattenText(text: unknown): string {
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.map(flattenText).filter(Boolean).join(' ')
  return ''
}

export function extractTextPair(
  response: SefariaTextResponse
): { en: string; he: string } {
  let en = ''
  let he = ''
  for (const v of response.versions) {
    const flat = flattenText(v.text)
    if (v.language === 'en' && !en) en = flat
    if (v.language === 'he' && !he) he = flat
  }
  return { en, he }
}

export function hitToText(hit: SefariaSearchHit): { en: string; he: string } {
  const src = hit._source
  return {
    en: src.exact || '',
    he: src.naive_lemmatizer || '',
  }
}

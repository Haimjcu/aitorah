import type {
  HebcalCalendarResponse,
  HebcalDateConversion,
  HebcalZmanimResponse,
  GeoInfo,
} from './types'
import { geoToHebcalParams } from './geo'

const BASE_URL = 'https://www.hebcal.com'

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

async function fetchHebcal<T>(path: string, ttlMs = 21600_000): Promise<T> {
  const cacheKey = `hebcal:${path}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Hebcal API error: ${res.status} for ${path}`)
  }
  const data = await res.json()
  setCache(cacheKey, data, ttlMs)
  return data as T
}

export async function getCalendarEvents(
  startDate: string,
  endDate: string,
  geo: GeoInfo | null,
  opts?: {
    parasha?: boolean
    holidays?: boolean
    dailyLearning?: boolean
    candleLighting?: boolean
  }
): Promise<HebcalCalendarResponse> {
  const o = { parasha: true, holidays: true, dailyLearning: true, candleLighting: true, ...opts }

  const params = new URLSearchParams({
    v: '1',
    cfg: 'json',
    start: startDate,
    end: endDate,
  })

  if (o.parasha) params.set('s', 'on')
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
    params.set('F', 'on')
    params.set('myomi', 'on')
    params.set('yyomi', 'on')
    params.set('dty', 'on')
    params.set('dr1', 'on')
    params.set('dcc', 'on')
    params.set('dps', 'on')
  }
  if (geo) {
    params.set('i', geo.isIsrael ? 'on' : 'off')
    if (o.candleLighting) {
      params.set('c', 'on')
      params.set('M', 'on')
    }
    const locParams = geoToHebcalParams(geo)
    locParams.forEach((v, k) => params.set(k, v))
  }

  return fetchHebcal<HebcalCalendarResponse>(`/hebcal?${params}`)
}

export async function getShabbatTimes(
  geo: GeoInfo
): Promise<HebcalCalendarResponse> {
  const params = new URLSearchParams({
    cfg: 'json',
    M: 'on',
    leyning: 'on',
  })
  params.set('i', geo.isIsrael ? 'on' : 'off')
  const locParams = geoToHebcalParams(geo)
  locParams.forEach((v, k) => params.set(k, v))

  return fetchHebcal<HebcalCalendarResponse>(`/shabbat?${params}`)
}

export async function getZmanim(
  date: string,
  geo: GeoInfo
): Promise<HebcalZmanimResponse> {
  const params = new URLSearchParams({ cfg: 'json', date })
  const locParams = geoToHebcalParams(geo)
  locParams.forEach((v, k) => params.set(k, v))

  return fetchHebcal<HebcalZmanimResponse>(`/zmanim?${params}`)
}

export async function gregorianToHebrew(
  date: string
): Promise<HebcalDateConversion> {
  return fetchHebcal<HebcalDateConversion>(
    `/converter?cfg=json&g2h=1&date=${date}&strict=1`,
    86400_000
  )
}

export async function hebrewToGregorian(
  hy: number,
  hm: string,
  hd: number
): Promise<HebcalDateConversion> {
  return fetchHebcal<HebcalDateConversion>(
    `/converter?cfg=json&h2g=1&hy=${hy}&hm=${encodeURIComponent(hm)}&hd=${hd}&strict=1`,
    86400_000
  )
}

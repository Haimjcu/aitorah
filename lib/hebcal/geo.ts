import { NextRequest } from 'next/server'
import type { GeoInfo } from './types'

const DEFAULT_GEO: GeoInfo = {
  geonameid: 5128581,
  latitude: 40.7128,
  longitude: -74.006,
  city: 'New York',
  country: 'United States',
  countryCode: 'US',
  timezone: 'America/New_York',
  isIsrael: false,
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

const geoCache = new Map<string, { data: GeoInfo; expires: number }>()

export async function resolveGeo(req: NextRequest): Promise<GeoInfo> {
  const ip = getIP(req)

  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return DEFAULT_GEO
  }

  const cached = geoCache.get(ip)
  if (cached && Date.now() < cached.expires) return cached.data

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon,timezone`
    )
    const data = await res.json()

    if (data.status !== 'success') return DEFAULT_GEO

    const geo: GeoInfo = {
      geonameid: null,
      latitude: data.lat,
      longitude: data.lon,
      city: data.city ?? '',
      country: data.country ?? '',
      countryCode: data.countryCode ?? '',
      timezone: data.timezone ?? 'America/New_York',
      isIsrael: data.countryCode === 'IL',
    }

    geoCache.set(ip, { data: geo, expires: Date.now() + 86400_000 })
    if (geoCache.size > 1000) {
      const oldest = geoCache.keys().next().value
      if (oldest) geoCache.delete(oldest)
    }

    return geo
  } catch {
    return DEFAULT_GEO
  }
}

export function geoToHebcalParams(geo: GeoInfo): URLSearchParams {
  const params = new URLSearchParams()
  if (geo.geonameid) {
    params.set('geo', 'geoname')
    params.set('geonameid', String(geo.geonameid))
  } else {
    params.set('geo', 'pos')
    params.set('latitude', String(geo.latitude))
    params.set('longitude', String(geo.longitude))
    params.set('tzid', geo.timezone)
  }
  return params
}

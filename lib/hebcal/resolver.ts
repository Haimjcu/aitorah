import type { ParsedIntent } from '../rag/intent'
import type { GeoInfo, HebcalZmanim } from './types'
import {
  getCalendarEvents,
  getShabbatTimes,
  getZmanim,
  gregorianToHebrew,
  hebrewToGregorian,
} from './client'

export interface CalendarContext {
  text: string
  location?: string
  parashaRef?: string
}

export async function resolveCalendar(
  intent: ParsedIntent,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  const today = new Date().toISOString().split('T')[0]
  const cp = intent.calendar_params

  switch (intent.type) {
    case 'calendar_parasha':
      return resolveParasha(geo)
    case 'calendar_learning':
      return resolveDailyLearning(today, geo, cp?.learning_type)
    case 'calendar_shabbat':
      return resolveShabbatTimes(geo)
    case 'calendar_zmanim':
      return resolveZmanim(cp?.date_reference ?? 'today', geo)
    case 'calendar_holiday':
      return resolveHolidays(today, geo)
    case 'calendar_date':
      return resolveDateConversion(cp, today)
    case 'calendar_general':
      return resolveGeneralCalendar(today, geo)
    default:
      return resolveGeneralCalendar(today, geo)
  }
}

async function resolveParasha(geo: GeoInfo | null): Promise<CalendarContext> {
  const defaultGeo: GeoInfo = geo ?? {
    geonameid: 5128581,
    latitude: 40.7128,
    longitude: -74.006,
    city: 'New York',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/New_York',
    isIsrael: false,
  }

  const data = await getShabbatTimes(defaultGeo)

  const parashat = data.items.find(i => i.category === 'parashat')
  const candles = data.items.find(i => i.category === 'candles')
  const havdalah = data.items.find(i => i.category === 'havdalah')

  const parts: string[] = [`[Calendar Data — This Week's Parasha]`]

  let parashaRef: string | undefined
  if (parashat) {
    parts.push(`Parashat ha-Shavuah: ${parashat.title} (${parashat.hebrew})`)
    if (parashat.leyning) {
      if (parashat.leyning.torah) {
        parts.push(`Torah reading: ${parashat.leyning.torah}`)
        parashaRef = parashat.leyning.torah.split('-')[0].trim()
      }
      if (parashat.leyning.haftarah) parts.push(`Haftarah: ${parashat.leyning.haftarah}`)
      if (parashat.leyning.maftir) parts.push(`Maftir: ${parashat.leyning.maftir}`)
      for (let i = 1; i <= 7; i++) {
        const key = String(i) as keyof typeof parashat.leyning
        if (parashat.leyning[key]) parts.push(`Aliyah ${i}: ${parashat.leyning[key]}`)
      }
    }
    if (parashat.link) parts.push(`More info: ${parashat.link}`)
  }

  parts.push(`Schedule: ${defaultGeo.isIsrael ? 'Israel' : 'Diaspora'}`)
  if (candles) parts.push(`Candle lighting: ${candles.title} (${candles.date})`)
  if (havdalah) parts.push(`Havdalah: ${havdalah.title} (${havdalah.date})`)

  const location = `${defaultGeo.city}, ${defaultGeo.country}`
  parts.push(`Location: ${location}${!geo ? ' (default — tell me your city for local times)' : ''}`)

  return { text: parts.join('\n'), location, parashaRef }
}

const CHABAD_ONLY_TYPES = new Set(['tanya', 'hayom_yom', 'chumash_rashi'])

const CHABAD_STUDIES: { key: string; name: string; path: string; query?: string; description: string }[] = [
  { key: 'chumash_rashi', name: 'Chumash with Rashi', path: '/dailystudy/torahreading.asp', description: 'Daily Chumash portion divided by the days of the week (Sunday through Shabbat), with Rashi\'s commentary' },
  { key: 'tanya', name: 'Tanya', path: '/dailystudy/tanya.asp', description: 'Daily portion of Tanya (Likutei Amarim) by Rabbi Schneur Zalman of Liadi, divided into daily readings across the year' },
  { key: 'hayom_yom', name: 'Hayom Yom', path: '/dailystudy/hayomyom.asp', description: 'Daily insights and customs compiled by the Lubavitcher Rebbe, Rabbi Menachem M. Schneerson, from the teachings of the Previous Rebbe' },
  { key: 'rambam_3', name: 'Rambam - 3 Chapters', path: '/dailystudy/rambam.asp', query: 'rambamChapters=3', description: 'Three chapters of Rambam\'s Mishneh Torah per day (completes the cycle in roughly one year)' },
  { key: 'rambam_1', name: 'Rambam - 1 Chapter', path: '/dailystudy/rambam.asp', query: 'rambamChapters=1', description: 'One chapter of Rambam\'s Mishneh Torah per day (completes the cycle in roughly three years)' },
  { key: 'sefer_hamitzvos', name: 'Daily Mitzvah (Sefer HaMitzvos)', path: '/dailystudy/seferHamitzvos.asp', description: 'Daily study of Rambam\'s Sefer HaMitzvos, corresponding to the Rambam 3-chapter cycle' },
]

function buildChabadUrl(study: typeof CHABAD_STUDIES[number], date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const y = date.getFullYear()
  const tdate = `${m}/${d}/${y}`
  const qs = study.query ? `tdate=${tdate}&${study.query}` : `tdate=${tdate}`
  return `https://www.chabad.org${study.path}?${qs}`
}

function formatChabadSection(studies: typeof CHABAD_STUDIES, date: Date): string {
  const parts: string[] = ['\n[Chabad Daily Study Links — Read the full text on Chabad.org]']
  for (const s of studies) {
    parts.push(`• ${s.name}: ${buildChabadUrl(s, date)}`)
    parts.push(`  (${s.description})`)
  }
  return parts.join('\n')
}

async function resolveDailyLearning(
  today: string,
  geo: GeoInfo | null,
  learningType: string | null | undefined
): Promise<CalendarContext> {
  const date = new Date(today + 'T12:00:00')
  const isChabadOnly = learningType && CHABAD_ONLY_TYPES.has(learningType)

  const parts = [`[Calendar Data — Daily Learning for ${today}]`]

  if (!isChabadOnly) {
    const data = await getCalendarEvents(today, today, geo, {
      parasha: false,
      holidays: false,
      dailyLearning: true,
      candleLighting: false,
    })

    for (const item of data.items) {
      parts.push(`${item.title}${item.hebrew ? ' (' + item.hebrew + ')' : ''}`)
      if (item.memo) parts.push(`  ${item.memo}`)
    }
    if (data.items.length === 0) {
      parts.push('No daily learning data available from Hebcal for this date.')
    }
  }

  if (learningType && learningType !== 'all' && !isChabadOnly) {
    const matched = CHABAD_STUDIES.filter(s => s.key === learningType)
    if (matched.length > 0) {
      parts.push(formatChabadSection(matched, date))
    }
  } else if (isChabadOnly) {
    const matched = CHABAD_STUDIES.filter(s => s.key === learningType)
    parts.push(formatChabadSection(matched, date))
    parts.push('\nIMPORTANT: The user asked specifically about ' + matched[0]?.name + '. Direct them to the Chabad.org link above to read the full text. Describe what this daily study program is and how it works.')
  } else {
    parts.push(formatChabadSection(CHABAD_STUDIES, date))
  }

  return { text: parts.join('\n') }
}

async function resolveShabbatTimes(geo: GeoInfo | null): Promise<CalendarContext> {
  if (!geo) {
    return {
      text: '[Calendar Data — Shabbat Times]\nLocation unknown. Cannot provide specific Shabbat times without a location. Please tell me your city or ZIP code for accurate times.',
    }
  }

  const data = await getShabbatTimes(geo)
  const location = `${geo.city}, ${geo.country}`
  const parts = [`[Calendar Data — Shabbat Times for ${location}]`]

  for (const item of data.items) {
    if (item.category === 'candles') {
      parts.push(`Candle lighting: ${item.title} — ${formatTime(item.date)}`)
    } else if (item.category === 'havdalah') {
      parts.push(`Havdalah: ${item.title} — ${formatTime(item.date)}`)
    } else if (item.category === 'parashat') {
      parts.push(`Parasha: ${item.title} (${item.hebrew})`)
    } else if (item.category === 'holiday') {
      parts.push(`Holiday: ${item.title} (${item.hebrew})`)
    }
  }

  return { text: parts.join('\n'), location }
}

async function resolveZmanim(
  dateRef: string,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  if (!geo) {
    return {
      text: '[Calendar Data — Zmanim]\nLocation unknown. Cannot provide halachic times without a location. Please tell me your city or ZIP code.',
    }
  }

  const date = resolveDateReference(dateRef)
  const data = await getZmanim(date, geo)

  const location = `${geo.city}, ${geo.country}`
  const parts = [`[Calendar Data — Zmanim for ${date} in ${location}]`]

  const labels: [keyof HebcalZmanim, string][] = [
    ['alotHaShachar', 'Alot HaShachar (Dawn)'],
    ['misheyakir', 'Misheyakir (Earliest Tallit/Tefillin)'],
    ['sunrise', 'Netz HaChama (Sunrise)'],
    ['sofZmanShma', 'Sof Zman Shma (GR"A)'],
    ['sofZmanShmaMGA', 'Sof Zman Shma (MG"A)'],
    ['sofZmanTfilla', 'Sof Zman Tefillah (GR"A)'],
    ['sofZmanTfillaMGA', 'Sof Zman Tefillah (MG"A)'],
    ['chatzot', 'Chatzot (Midday)'],
    ['minchaGedola', 'Mincha Gedola'],
    ['minchaKetana', 'Mincha Ketana'],
    ['plagHaMincha', 'Plag HaMincha'],
    ['sunset', 'Shkiah (Sunset)'],
    ['beinHaShmashos', 'Bein HaShmashot'],
    ['tzeit7083deg', 'Tzeit HaKochavim (7.083°)'],
    ['tzeit85deg', 'Tzeit HaKochavim (8.5°)'],
  ]

  for (const [key, label] of labels) {
    const val = data.times[key]
    if (val) parts.push(`${label}: ${formatTime(val)}`)
  }

  return { text: parts.join('\n'), location }
}

async function resolveHolidays(
  today: string,
  geo: GeoInfo | null
): Promise<CalendarContext> {
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
  for (const h of holidays.slice(0, 25)) {
    const extra = h.subcat ? ` (${h.subcat})` : ''
    parts.push(`${h.date.split('T')[0]} — ${h.title}${extra} (${h.hebrew})`)
    if (h.memo) parts.push(`  ${h.memo}`)
  }
  if (holidays.length === 0) {
    parts.push('No upcoming holidays found in the next 90 days.')
  }

  return { text: parts.join('\n') }
}

async function resolveDateConversion(
  cp: ParsedIntent['calendar_params'],
  today: string
): Promise<CalendarContext> {
  const parts: string[] = []

  if (cp?.hebrew_date?.hy && cp.hebrew_date.hm && cp.hebrew_date.hd) {
    const result = await hebrewToGregorian(
      cp.hebrew_date.hy, cp.hebrew_date.hm, cp.hebrew_date.hd
    )
    parts.push(`[Calendar Data — Hebrew to Gregorian Date Conversion]`)
    parts.push(`Hebrew: ${result.hebrew} (${result.hd} ${result.hm} ${result.hy})`)
    parts.push(`Gregorian: ${result.gy}-${String(result.gm).padStart(2, '0')}-${String(result.gd).padStart(2, '0')}`)
    if (result.events.length > 0) parts.push(`Events on this date: ${result.events.join(', ')}`)
    return { text: parts.join('\n') }
  }

  const date = cp?.gregorian_date ?? today
  const result = await gregorianToHebrew(date)
  parts.push(`[Calendar Data — Gregorian to Hebrew Date Conversion]`)
  parts.push(`Gregorian: ${result.gy}-${String(result.gm).padStart(2, '0')}-${String(result.gd).padStart(2, '0')}`)
  parts.push(`Hebrew: ${result.hebrew}`)
  parts.push(`Hebrew date parts: ${result.heDateParts.d} ${result.heDateParts.m} ${result.heDateParts.y}`)
  if (result.events.length > 0) parts.push(`Events on this date: ${result.events.join(', ')}`)

  return { text: parts.join('\n') }
}

async function resolveGeneralCalendar(
  today: string,
  geo: GeoInfo | null
): Promise<CalendarContext> {
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const endStr = weekEnd.toISOString().split('T')[0]

  const [dateConv, events] = await Promise.allSettled([
    gregorianToHebrew(today),
    getCalendarEvents(today, endStr, geo),
  ])

  const parts = [`[Calendar Data — This Week (${today})]`]

  if (dateConv.status === 'fulfilled') {
    parts.push(`Today's Hebrew date: ${dateConv.value.hebrew}`)
    if (dateConv.value.events.length > 0) {
      parts.push(`Today's events: ${dateConv.value.events.join(', ')}`)
    }
  }

  if (events.status === 'fulfilled') {
    for (const item of events.value.items.slice(0, 20)) {
      parts.push(`${item.date.split('T')[0]} — ${item.title} [${item.category}]`)
    }
  }

  const location = geo ? `${geo.city}, ${geo.country}` : undefined
  if (location) parts.push(`Location: ${location}`)

  return { text: parts.join('\n'), location }
}

function formatTime(isoOrTime: string): string {
  try {
    // ISO strings like "2026-06-17T05:24:00-04:00" already have local time before the offset
    const timeMatch = isoOrTime.match(/T(\d{2}):(\d{2})/)
    if (timeMatch) {
      const hour = parseInt(timeMatch[1])
      const minute = timeMatch[2]
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${h12}:${minute} ${ampm}`
    }
    return isoOrTime
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
  if (ref === 'yesterday') {
    today.setDate(today.getDate() - 1)
    return today.toISOString().split('T')[0]
  }
  return ref
}

export interface HebcalLocation {
  title: string
  city: string
  tzid: string
  latitude: number
  longitude: number
  cc: string
  country: string
  admin1?: string
  geonameid: number
  geo: string
}

export interface HebcalEvent {
  title: string
  date: string
  category: string
  subcat?: string
  hebrew: string
  hdate?: string
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
  hebrew: string
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
  geonameid: number | null
  latitude: number
  longitude: number
  city: string
  country: string
  countryCode: string
  timezone: string
  isIsrael: boolean
}

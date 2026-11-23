// UI languages (owner decision: 8 languages). Hebrew and Yiddish are right-to-left.
export const LOCALES = ['en', 'he', 'fr', 'es', 'ru', 'yi', 'pt', 'de'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const RTL_LOCALES: Locale[] = ['he', 'yi']
export const LOCALE_COOKIE = 'locale'

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', he: 'עברית', fr: 'Français', es: 'Español', ru: 'Русский', yi: 'ייִדיש', pt: 'Português', de: 'Deutsch',
}

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
export const dirFor = (l: Locale): 'rtl' | 'ltr' => (RTL_LOCALES.includes(l) ? 'rtl' : 'ltr')

/** Cookie wins; otherwise the best match from Accept-Language; otherwise English. */
export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue
  for (const part of (acceptLanguage ?? '').split(',')) {
    const code = part.split(';')[0].trim().toLowerCase().slice(0, 2)
    if (code === 'iw') return 'he'
    if (isLocale(code)) return code
  }
  return DEFAULT_LOCALE
}

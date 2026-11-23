import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, resolveLocale, type Locale } from './config'
import { getMessages, makeT } from './index'

/** Server components in the app section: current locale and translator. */
export async function getServerI18n(): Promise<{ locale: Locale; t: ReturnType<typeof makeT> }> {
  const c = await cookies()
  const h = await headers()
  const locale = resolveLocale(c.get(LOCALE_COOKIE)?.value, h.get('accept-language'))
  return { locale, t: makeT(getMessages(locale)) }
}

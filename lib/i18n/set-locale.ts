// Client-side: change the site (UI) language. Used by the sidebar switcher and the Settings page.
import { LOCALE_COOKIE, type Locale } from './config'

/** Saves the locale cookie (and the profile when signed in). The caller refreshes the page afterwards. */
export async function saveLocale(next: Locale, signedIn: boolean) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  if (signedIn) {
    await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uiLanguage: next }),
    }).catch(() => {})
  }
}

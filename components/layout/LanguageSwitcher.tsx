'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/components/providers/I18nProvider'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config'
import { saveLocale } from '@/lib/i18n/set-locale'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const { status } = useSession()

  async function change(next: Locale) {
    await saveLocale(next, status === 'authenticated')
    router.refresh()
  }

  return (
    <label className={`flex items-center gap-2 text-xs text-[var(--text-sec)] ${className}`}>
      <span>{t('nav.language')}</span>
      <select value={locale} onChange={(e) => change(e.target.value as Locale)}
        className="flex-1 text-xs px-2 py-1 border border-[var(--border)] rounded bg-white">
        {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  )
}

'use client'

import { createContext, useContext, useMemo } from 'react'
import { dirFor, type Locale } from '@/lib/i18n/config'
import { makeT, type TFunction } from '@/lib/i18n'
import { en } from '@/lib/i18n/messages/en'
import type { Messages } from '@/lib/i18n/messages/en'

interface I18nValue { locale: Locale; dir: 'ltr' | 'rtl'; t: TFunction }

// Outside the app section (marketing pages) there is no provider: default to English.
const I18nContext = createContext<I18nValue>({ locale: 'en', dir: 'ltr', t: makeT(en) })

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dir: dirFor(locale), t: makeT(messages) }), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)

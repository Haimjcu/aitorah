import { en, type Messages } from './messages/en'
import type { Locale } from './config'
import he from './messages/he.json'
import fr from './messages/fr.json'
import es from './messages/es.json'
import ru from './messages/ru.json'
import yi from './messages/yi.json'
import pt from './messages/pt.json'
import de from './messages/de.json'

const ALL = { en, he, fr, es, ru, yi, pt, de } as unknown as Record<Locale, Partial<Messages>>

/** Locale messages with English fallback for any key not yet translated. */
export function getMessages(locale: Locale): Messages {
  const m = ALL[locale] ?? {}
  const out = {} as Record<string, Record<string, string>>
  for (const [section, entries] of Object.entries(en)) {
    out[section] = { ...entries, ...((m as Record<string, Record<string, string>>)[section] ?? {}) }
  }
  return out as unknown as Messages
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string

export function makeT(messages: Messages): TFunction {
  return (key, vars) => {
    const [section, name] = key.split('.')
    let s = (messages as unknown as Record<string, Record<string, string>>)[section]?.[name] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
}

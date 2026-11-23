'use client'

import { useState } from 'react'
import { useI18n } from '@/components/providers/I18nProvider'

const CATEGORIES = ['wrong_fact', 'wrong_source', 'missing_view', 'translation', 'formatting', 'tone', 'other']

export function CorrectionForm({ question, answer, meta, qaPairId, onDone }: {
  question: string
  answer: string
  meta?: { domains?: string[]; skillVersions?: Record<string, unknown> }
  qaPairId?: string
  onDone: () => void
}) {
  const { t } = useI18n()
  const [category, setCategory] = useState('wrong_fact')
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (text.trim().length < 5) return
    setState('sending')
    const res = await fetch('/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, text, category, qaPairId, domain: meta?.domains?.[0], skillVersions: meta?.skillVersions }),
    }).catch(() => null)
    setState(res?.ok ? 'sent' : 'error')
    if (res?.ok) setTimeout(onDone, 2500)
  }

  if (state === 'sent') {
    return <p className="mt-2 text-xs text-green-700">{t('correction.thanks')}</p>
  }

  return (
    <form onSubmit={submit} className="mt-2 bg-[var(--surface-alt)] border border-[var(--border)] rounded-md p-3 flex flex-col gap-2 max-w-xl">
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-xs px-2 py-1.5 border border-[var(--border)] rounded bg-white">
        {CATEGORIES.map((v) => <option key={v} value={v}>{t(`correction.${v}`)}</option>)}
      </select>
      <textarea value={text} onChange={(e) => setText(e.target.value)} dir="auto" required minLength={5}
        placeholder={t('correction.placeholder')}
        className="text-sm px-3 py-2 border border-[var(--border)] rounded bg-white h-24" />
      <div className="flex items-center gap-2">
        <button disabled={state === 'sending'} className="px-3 py-1.5 text-xs rounded-md bg-[var(--primary)] text-white disabled:opacity-50">
          {state === 'sending' ? t('correction.sending') : t('correction.send')}
        </button>
        <button type="button" onClick={onDone} className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)]">{t('correction.cancel')}</button>
        {state === 'error' && <span className="text-xs text-red-700">{t('correction.failed')}</span>}
      </div>
    </form>
  )
}

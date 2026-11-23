'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/components/providers/I18nProvider'

interface Profile {
  uiLanguage: string | null
  answerLanguage: string | null
  nusach: string | null
  level: string | null
}

const LANGS: [string, string][] = [
  ['', 'settings.sameAsI'], ['en', 'English'], ['he', 'עברית'], ['fr', 'Français'], ['es', 'Español'],
  ['ru', 'Русский'], ['yi', 'ייִדיש'], ['pt', 'Português'], ['de', 'Deutsch'],
]
const NUSACH: [string, string][] = [
  ['', 'settings.notSetCommunity'], ['ashkenazi', 'settings.ashkenazi'], ['sephardi', 'settings.sephardi'],
  ['chassidic_sefard', 'settings.chassidic_sefard'], ['chabad', 'settings.chabad'], ['teimani', 'settings.teimani'], ['other', 'settings.otherCommunity'],
]
const LEVELS: [string, string][] = [['', 'settings.notSet'], ['beginner', 'settings.beginner'], ['intermediate', 'settings.intermediate'], ['advanced', 'settings.advanced']]

export function ProfileSettings() {
  const { status } = useSession()
  const { t } = useI18n()
  const [profile, setProfile] = useState<Profile>({ uiLanguage: null, answerLanguage: null, nusach: null, level: null })
  const [memories, setMemories] = useState<{ id: string; content: string }[]>([])
  const [saved, setSaved] = useState(false)
  const [newMemory, setNewMemory] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/profile')
    if (!res.ok) return
    const d = await res.json()
    if (d.profile) setProfile(d.profile)
    setMemories(d.memories ?? [])
  }, [])

  useEffect(() => { if (status === 'authenticated') load() }, [status, load])

  async function update(patch: Partial<Profile>) {
    const next = { ...profile, ...patch }
    setProfile(next)
    await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  async function addMemory(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemory.trim()) return
    await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newMemory }) })
    setNewMemory(''); load()
  }

  async function removeMemory(id: string) {
    await fetch(`/api/memories?id=${id}`, { method: 'DELETE' }); load()
  }

  if (status === 'unauthenticated') {
    return <p className="text-sm text-[var(--text-sec)]"><Link href="/study" className="text-[var(--primary)] underline">{t('settings.signInPrompt')}</Link></p>
  }

  const select = (label: string, hint: string, value: string | null, options: [string, string][], key: keyof Profile) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-[var(--text-sec)]">{hint}</span>
      <select value={value ?? ''} onChange={(e) => update({ [key]: e.target.value || null })}
        className="text-sm px-3 py-2 border border-[var(--border)] rounded-md bg-white max-w-sm">
        {options.map(([v, l]) => <option key={v} value={v}>{l.startsWith('settings.') ? t(l) : l}</option>)}
      </select>
    </label>
  )

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <section className="bg-white border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t('settings.preferences')}</h3>
          {saved && <span className="text-xs text-green-700">{t('settings.saved')}</span>}
        </div>
        {select(t('settings.community'), t('settings.communityHint'), profile.nusach, NUSACH, 'nusach')}
        {select(t('settings.answerLanguage'), t('settings.answerLanguageHint'), profile.answerLanguage, LANGS, 'answerLanguage')}
        {select(t('settings.level'), t('settings.levelHint'), profile.level, LEVELS, 'level')}
      </section>

      <section className="bg-white border border-[var(--border)] rounded-xl p-5">
        <h3 className="font-semibold mb-1">{t('settings.memory')}</h3>
        <p className="text-xs text-[var(--text-sec)] mb-3">{t('settings.memoryHint')}</p>
        <form onSubmit={addMemory} className="flex gap-2 mb-3">
          <input value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder={t('settings.memoryPlaceholder')} dir="auto"
            className="flex-1 text-sm px-3 py-2 border border-[var(--border)] rounded-md" />
          <button className="px-3 py-1.5 text-sm rounded-md border border-[var(--primary)] text-[var(--primary)]">{t('settings.add')}</button>
        </form>
        {memories.length === 0 ? <p className="text-sm text-[var(--text-sec)]">{t('settings.nothingSaved')}</p> : (
          <div className="flex flex-col gap-1">
            {memories.map((m) => (
              <div key={m.id} className="border border-[var(--border)] rounded-md px-3 py-2 text-sm flex items-start gap-3">
                <span className="flex-1" dir="auto">{m.content}</span>
                <button onClick={() => removeMemory(m.id)} className="text-xs text-[var(--text-sec)] hover:text-red-700">{t('settings.remove')}</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

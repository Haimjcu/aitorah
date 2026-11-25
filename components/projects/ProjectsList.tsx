'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/components/providers/I18nProvider'

const HOW_HIDDEN_KEY = 'aitorah:projects-how-hidden'

/** Explains projects in three steps. Open when the user has no projects; can be hidden (remembered on this device). */
function HowProjectsWork({ hasProjects }: { hasProjects: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    let hidden = false
    try { hidden = localStorage.getItem(HOW_HIDDEN_KEY) === '1' } catch { /* ignore */ }
    setOpen(!hasProjects || !hidden)
  }, [hasProjects])

  function toggle(next: boolean) {
    setOpen(next)
    try { if (next) localStorage.removeItem(HOW_HIDDEN_KEY); else localStorage.setItem(HOW_HIDDEN_KEY, '1') } catch { /* ignore */ }
  }

  if (open === null) return null
  if (!open) {
    return (
      <button type="button" onClick={() => toggle(true)} className="self-start inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        {t('projects.howShow')}
      </button>
    )
  }

  const steps: [string, string][] = [
    [t('projects.howStep1Title'), t('projects.howStep1')],
    [t('projects.howStep2Title'), t('projects.howStep2')],
    [t('projects.howStep3Title'), t('projects.howStep3')],
  ]
  return (
    <section className="bg-[#f5f7ff] border border-[#dfe4fb] rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-[var(--primary)]">{t('projects.howTitle')}</h2>
        {hasProjects && (
          <button type="button" onClick={() => toggle(false)} className="text-xs text-[var(--text-sec)] hover:text-[var(--text)]">{t('projects.howHide')}</button>
        )}
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={i} className="flex gap-3">
            <span className="w-7 h-7 flex-shrink-0 rounded-full bg-[var(--primary)] text-white text-sm font-semibold flex items-center justify-center">{i + 1}</span>
            <div>
              <div className="text-sm font-medium">{title}</div>
              <p className="text-xs text-[var(--text-sec)] mt-0.5 leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-[var(--text-sec)] mt-3 flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {t('projects.howPrivate')}
      </p>
    </section>
  )
}

interface ProjectRow {
  id: string
  title: string
  description: string | null
  updatedAt: string
  sessionCount: number
  fileCount: number
}

export function ProjectsList() {
  const { status } = useSession()
  const { t } = useI18n()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (res.ok) setProjects(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { if (status === 'authenticated') load(); else if (status === 'unauthenticated') setLoading(false) }, [status, load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Could not create project'); return }
    setTitle(''); setDescription('')
    load()
  }

  if (status === 'unauthenticated') {
    return (
      <div className="max-w-3xl flex flex-col gap-6">
        <HowProjectsWork hasProjects={false} />
        <p className="text-sm text-[var(--text-sec)]">
          <Link href="/study" className="text-[var(--primary)] underline">{t('projects.signInPrompt')}</Link>
        </p>
      </div>
    )
  }

  const ideas = [t('projects.idea1'), t('projects.idea2'), t('projects.idea3')]

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      {!loading && <HowProjectsWork hasProjects={projects.length > 0} />}
      <form onSubmit={create} className="bg-white border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
        <div className="text-sm font-semibold">{t('projects.newProject')}</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('projects.titlePlaceholder')} dir="auto"
          className="text-sm px-3 py-2 border border-[var(--border)] rounded-md" required />
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-sec)]">
          <span>{t('projects.ideas')}</span>
          {ideas.map((idea) => (
            <button key={idea} type="button" onClick={() => setTitle(idea)}
              className="px-2.5 py-0.5 rounded-full border border-[var(--border)] bg-white hover:border-[var(--primary)] hover:text-[var(--primary)]">
              {idea}
            </button>
          ))}
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('projects.descriptionPlaceholder')} dir="auto"
          className="text-sm px-3 py-2 border border-[var(--border)] rounded-md h-20" />
        <div className="flex items-center gap-3">
          <button className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white">{t('projects.create')}</button>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
      </form>

      {loading ? <p className="text-sm text-[var(--text-sec)]">{t('projects.loading')}</p> : projects.length === 0 ? (
        <p className="text-sm text-[var(--text-sec)]">{t('projects.none')}</p>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="bg-white border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] transition-colors">
              <div className="font-medium" dir="auto">{p.title}</div>
              {p.description && <div className="text-sm text-[var(--text-sec)] mt-1 line-clamp-2" dir="auto">{p.description}</div>}
              <div className="text-xs text-[var(--text-sec)] mt-2">
                {t('projects.chats', { count: p.sessionCount })} · {t('projects.files', { count: p.fileCount })} · {t('projects.updated', { date: new Date(p.updatedAt).toLocaleDateString() })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/components/providers/I18nProvider'

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
      <p className="text-sm text-[var(--text-sec)]">
        <Link href="/study" className="text-[var(--primary)] underline">{t('projects.signInPrompt')}</Link>
      </p>
    )
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <form onSubmit={create} className="bg-white border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
        <div className="text-sm font-semibold">{t('projects.newProject')}</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('projects.titlePlaceholder')} dir="auto"
          className="text-sm px-3 py-2 border border-[var(--border)] rounded-md" required />
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

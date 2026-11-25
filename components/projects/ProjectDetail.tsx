'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/components/providers/I18nProvider'
import { InfoTip } from '@/components/ui/InfoTip'

interface Detail {
  project: { id: string; title: string; description: string | null }
  sessions: { id: string; title: string | null; updatedAt: string }[]
  memories: { id: string; content: string; kind: string; createdAt: string }[]
  files: { id: string; filename: string; mime: string; sizeBytes: number; status: string; createdAt: string }[]
}

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter()
  const { t } = useI18n()
  const [d, setD] = useState<Detail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) { setNotFound(true); return }
    const data: Detail = await res.json()
    setD(data); setTitle(data.project.title); setDescription(data.project.description ?? '')
  }, [id])

  useEffect(() => { load() }, [load])

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: note, projectId: id }) })
    setNote(''); load()
  }

  async function removeNote(memId: string) {
    await fetch(`/api/memories?id=${memId}`, { method: 'DELETE' }); load()
  }

  async function save() {
    await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description }) })
    setEditing(false); load()
  }

  async function archive() {
    if (!window.confirm(t('projects.archiveConfirm'))) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    router.push('/projects')
  }

  if (notFound) return <p className="text-sm text-[var(--text-sec)]">{t('projects.notFound')} <Link href="/projects" className="underline">{t('projects.allProjects')}</Link></p>
  if (!d) return <p className="text-sm text-[var(--text-sec)]">{t('projects.loading')}</p>

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <section className="bg-white border border-[var(--border)] rounded-xl p-4">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" className="text-sm px-3 py-2 border border-[var(--border)] rounded-md" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} dir="auto" className="text-sm px-3 py-2 border border-[var(--border)] rounded-md h-20" />
            <div className="flex gap-2">
              <button onClick={save} className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white">{t('projects.save')}</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)]">{t('projects.cancel')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold" dir="auto">{d.project.title}</h2>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setEditing(true)} className="text-[var(--primary)] hover:underline">{t('projects.edit')}</button>
                <button onClick={archive} className="text-[var(--text-sec)] hover:underline">{t('projects.archive')}</button>
              </div>
            </div>
            {d.project.description && <p className="text-sm text-[var(--text-sec)] mt-1 whitespace-pre-wrap" dir="auto">{d.project.description}</p>}
          </>
        )}
        <div className="mt-4 flex items-center gap-2">
          <Link href={`/study?project=${id}`} className="inline-block px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white">
            {t('projects.newChat')}
          </Link>
          <InfoTip text={t('projects.newChatTip')} label={t('projects.info')} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">{t('projects.chatsHeading')} <InfoTip text={t('projects.chatsTip')} label={t('projects.info')} /></h3>
        {d.sessions.length === 0 ? <p className="text-sm text-[var(--text-sec)]">{t('projects.noChats')}</p> : (
          <div className="flex flex-col gap-1">
            {d.sessions.map((s) => (
              <Link key={s.id} href={`/study?project=${id}&session=${s.id}`} className="bg-white border border-[var(--border)] rounded-md px-3 py-2 text-sm hover:border-[var(--primary)]" dir="auto">
                {s.title ?? t('projects.untitled')} <span className="text-xs text-[var(--text-sec)]">· {new Date(s.updatedAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">{t('projects.memoryHeading')} <InfoTip text={t('projects.memoryTip')} label={t('projects.info')} /></h3>
        <p className="text-xs text-[var(--text-sec)] mb-2">{t('projects.memoryHint')}</p>
        <form onSubmit={addNote} className="flex gap-2 mb-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('projects.memoryPlaceholder')} dir="auto"
            className="flex-1 text-sm px-3 py-2 border border-[var(--border)] rounded-md" />
          <button className="px-3 py-1.5 text-sm rounded-md border border-[var(--primary)] text-[var(--primary)]">{t('projects.add')}</button>
        </form>
        {d.memories.length === 0 && <p className="text-sm text-[var(--text-sec)]">{t('projects.noMemory')}</p>}
        <div className="flex flex-col gap-1">
          {d.memories.map((m) => (
            <div key={m.id} className="bg-white border border-[var(--border)] rounded-md px-3 py-2 text-sm flex items-start gap-3">
              <span className="flex-1" dir="auto">{m.content}</span>
              <button onClick={() => removeNote(m.id)} className="text-xs text-[var(--text-sec)] hover:text-red-700">{t('projects.remove')}</button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">{t('projects.filesHeading')} <InfoTip text={t('projects.filesTip')} label={t('projects.info')} /></h3>
        <ProjectFiles projectId={id} files={d.files} onChange={load} />
      </section>
    </div>
  )
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown'

function ProjectFiles({ projectId, files, onChange }: { projectId: string; files: Detail['files']; onChange: () => void }) {
  const { t } = useI18n()
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setError(null)
    for (const file of Array.from(list)) {
      setUploading(t('projects.uploading', { name: file.name }))
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body: form })
      if (!res.ok) setError(`${file.name}: ${(await res.json().catch(() => ({}))).error ?? 'upload failed'}`)
      onChange()
    }
    setUploading(null)
  }

  async function remove(fileId: string) {
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await fetch(`/api/projects/${projectId}/files/${fileId}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--text-sec)]">{t('projects.filesHint')}</p>
      <label className="inline-flex items-center gap-2 w-fit px-3 py-1.5 text-sm rounded-md border border-[var(--primary)] text-[var(--primary)] cursor-pointer">
        <input type="file" accept={ACCEPT} multiple className="hidden" disabled={!!uploading} onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        {uploading ? t('projects.working') : t('projects.upload')}
      </label>
      {uploading && <p className="text-xs text-[var(--text-sec)]">{uploading}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {files.length === 0 && !uploading && <p className="text-sm text-[var(--text-sec)]">{t('projects.noFiles')}</p>}
      {files.map((f) => (
        <div key={f.id} className="bg-white border border-[var(--border)] rounded-md px-3 py-2 text-sm flex items-center gap-3">
          <a href={`/api/projects/${projectId}/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 hover:underline" dir="auto">{f.filename}</a>
          <span className={`text-xs ${f.status === 'ready' ? 'text-green-700' : f.status === 'failed' ? 'text-red-700' : 'text-[var(--text-sec)]'}`}>{f.status}</span>
          <span className="text-xs text-[var(--text-sec)]">{Math.max(1, Math.round(f.sizeBytes / 1024))} KB</span>
          <button onClick={() => remove(f.id)} className="text-xs text-[var(--text-sec)] hover:text-red-700">{t('projects.deleteFile')}</button>
        </div>
      ))}
    </div>
  )
}

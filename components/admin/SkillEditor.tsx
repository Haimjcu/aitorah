'use client'

import { useCallback, useEffect, useState } from 'react'

interface SkillSummary {
  id: string
  slug: string
  kind: string
  title: string
  activeVersion: number | null
  latestVersion: number | null
  drafts: number
  notes: string | null
}

interface SkillVersion {
  id: string
  version: number
  content: string
  status: 'draft' | 'active' | 'retired'
  createdBy: string | null
  notes: string | null
  createdAt: string
  activatedAt: string | null
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-amber-100 text-amber-800',
  retired: 'bg-gray-100 text-gray-600',
}

export function SkillEditor() {
  const [list, setList] = useState<SkillSummary[]>([])
  const [slug, setSlug] = useState<string | null>(null)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const res = await fetch('/api/admin/skills')
    if (res.ok) setList(await res.json())
  }, [])

  const loadSkill = useCallback(async (s: string) => {
    const res = await fetch(`/api/admin/skills/${s}`)
    if (!res.ok) return
    const data: { versions: SkillVersion[] } = await res.json()
    setVersions(data.versions)
    const active = data.versions.find((v) => v.status === 'active') ?? data.versions[0]
    setSelected(active?.version ?? null)
    setDraft(active?.content ?? '')
    setNotes('')
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { if (slug) loadSkill(slug) }, [slug, loadSkill])

  const current = versions.find((v) => v.version === selected)
  const dirty = current ? draft !== current.content : false

  async function saveDraft() {
    if (!slug) return
    setBusy(true); setMessage(null)
    const res = await fetch(`/api/admin/skills/${slug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft, notes }),
    })
    setBusy(false)
    if (!res.ok) { setMessage((await res.json()).error ?? 'Save failed'); return }
    const row: SkillVersion = await res.json()
    setMessage(`Saved draft v${row.version}. Test it before activating: npm run eval -- --target agent --skill ${slug}@${row.version}`)
    await loadSkill(slug); setSelected(row.version); await loadList()
  }

  async function act(version: number, action: 'activate' | 'retire') {
    if (!slug) return
    if (action === 'activate' && slug === 'domain-halacha_minhag' &&
        !window.confirm('Halachic skill: confirm this version was reviewed and approved (owner + rabbi).')) return
    setBusy(true); setMessage(null)
    const res = await fetch(`/api/admin/skills/${slug}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, action }),
    })
    setBusy(false)
    setMessage(res.ok ? `v${version} ${action === 'activate' ? 'is now active' : 'retired'}` : (await res.json()).error)
    await loadSkill(slug); await loadList()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <div className="flex flex-col gap-1">
        {list.map((s) => (
          <button
            key={s.slug}
            onClick={() => setSlug(s.slug)}
            className={`text-left px-3 py-2 rounded-md border text-sm ${slug === s.slug ? 'border-[var(--primary)] bg-[var(--surface-alt)]' : 'border-[var(--border)] bg-white hover:bg-[var(--surface-alt)]'}`}
          >
            <div className="font-medium">{s.title}</div>
            <div className="text-xs text-[var(--text-sec)]">
              {s.kind} · active v{s.activeVersion ?? '—'}{s.drafts ? ` · ${s.drafts} draft${s.drafts > 1 ? 's' : ''}` : ''}
            </div>
          </button>
        ))}
        {!list.length && <p className="text-sm text-[var(--text-sec)]">No skills yet. Run scripts/seed-skills.ts.</p>}
      </div>

      {slug ? (
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap gap-2">
            {versions.map((v) => (
              <button
                key={v.version}
                onClick={() => { setSelected(v.version); setDraft(v.content) }}
                className={`text-xs px-2 py-1 rounded border ${selected === v.version ? 'border-[var(--primary)]' : 'border-[var(--border)]'}`}
              >
                v{v.version} <span className={`ml-1 px-1.5 rounded ${STATUS_STYLE[v.status]}`}>{v.status}</span>
              </button>
            ))}
          </div>
          {current && (
            <div className="text-xs text-[var(--text-sec)]">
              v{current.version} by {current.createdBy ?? 'unknown'} · {new Date(current.createdAt).toLocaleString()}
              {current.notes ? ` · ${current.notes}` : ''}
            </div>
          )}
          <textarea
            dir="auto"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-[55vh] font-mono text-xs p-3 border border-[var(--border)] rounded-md bg-white"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What changed and why (saved with the new version)"
            className="w-full text-sm px-3 py-2 border border-[var(--border)] rounded-md bg-white"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <button disabled={busy || !dirty} onClick={saveDraft}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white disabled:opacity-40">
              Save as new draft
            </button>
            {current && current.status !== 'active' && (
              <button disabled={busy || dirty} onClick={() => act(current.version, 'activate')}
                className="px-3 py-1.5 text-sm rounded-md border border-green-600 text-green-700 disabled:opacity-40">
                Activate v{current.version}{current.status === 'retired' ? ' (rollback)' : ''}
              </button>
            )}
            {current && current.status === 'draft' && (
              <button disabled={busy} onClick={() => act(current.version, 'retire')}
                className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] disabled:opacity-40">
                Discard draft
              </button>
            )}
          </div>
          {message && <p className="text-sm text-[var(--text-sec)] break-all">{message}</p>}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-sec)]">Select a skill to view its versions.</p>
      )}
    </div>
  )
}

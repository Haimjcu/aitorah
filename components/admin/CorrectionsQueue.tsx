'use client'

import { useCallback, useEffect, useState } from 'react'

interface Correction {
  id: string
  text: string
  question: string | null
  answer: string | null
  category: string | null
  riskTier: string | null
  summary: string | null
  targetSkill: string | null
  status: string
  reviewNote: string | null
  createdAt: string
  userId: string | null
}

interface Proposal {
  id: string
  slug: string
  title: string
  status: string
  riskTier: string
  rationale: string | null
  proposedContent: string
  currentContent: string | null
  fromVersion: number | null
  createdAt: string
}

type View = 'review' | 'proposals' | 'accepted' | 'rejected'
const VIEWS: [View, string][] = [['review', 'Needs review'], ['proposals', 'Skill proposals'], ['accepted', 'Accepted / applied'], ['rejected', 'Rejected']]

const TIER_STYLE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700', high: 'bg-amber-100 text-amber-800', halachic: 'bg-red-100 text-red-800',
}

/** Minimal line diff (LCS) for skill proposals. */
function diffLines(a: string, b: string): { type: ' ' | '-' | '+'; line: string }[] {
  const x = a.split('\n'), y = b.split('\n')
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--)
    dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: { type: ' ' | '-' | '+'; line: string }[] = []
  let i = 0, j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { out.push({ type: ' ', line: x[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: '-', line: x[i++] })
    else out.push({ type: '+', line: y[j++] })
  }
  while (i < x.length) out.push({ type: '-', line: x[i++] })
  while (j < y.length) out.push({ type: '+', line: y[j++] })
  return out
}

export function CorrectionsQueue() {
  const [view, setView] = useState<View>('review')
  const [items, setItems] = useState<(Correction | Proposal)[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/corrections?view=${view}`)
    setItems(res.ok ? await res.json() : [])
  }, [view])
  useEffect(() => { load() }, [load])

  async function decide(id: string, action: 'accept' | 'reject') {
    setBusy(true)
    await fetch(`/api/admin/corrections/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    setBusy(false); load()
  }

  async function decideProposal(p: Proposal, action: 'approve' | 'reject') {
    if (action === 'approve' && p.riskTier === 'halachic' && !window.confirm('This changes halachic guidance. Confirm it was reviewed (owner + rabbi).')) return
    setBusy(true)
    await fetch(`/api/admin/proposals/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    setBusy(false); load()
  }

  return (
    <div className="max-w-4xl flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {VIEWS.map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} className={`text-sm px-3 py-1.5 rounded-md border ${view === v ? 'border-[var(--primary)] text-[var(--primary)] bg-white' : 'border-[var(--border)] text-[var(--text-sec)]'}`}>{label}</button>
        ))}
      </div>
      <p className="text-xs text-[var(--text-sec)]">
        Low-risk corrections go to the nightly learning loop automatically and apply only if evals don&apos;t get worse. High-risk and halachic corrections wait here for your decision. Accepting one lets the loop propose a skill change, which you then approve under &ldquo;Skill proposals&rdquo;.
      </p>

      {items.length === 0 && <p className="text-sm text-[var(--text-sec)]">Nothing here.</p>}

      {view === 'proposals'
        ? (items as Proposal[]).map((p) => (
          <div key={p.id} className="bg-white border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{p.title}</span>
              <span className={`text-xs px-1.5 rounded ${TIER_STYLE[p.riskTier] ?? ''}`}>{p.riskTier}</span>
              <span className="text-xs text-[var(--text-sec)]">{p.status} · {new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] whitespace-pre-wrap mt-2">{p.rationale}</p>
            <button onClick={() => setOpen(open === p.id ? null : p.id)} className="text-xs text-[var(--primary)] mt-2">{open === p.id ? 'Hide changes' : `Show changes vs. v${p.fromVersion}`}</button>
            {open === p.id && p.currentContent && (
              <pre className="mt-2 text-xs bg-[var(--surface-alt)] p-3 rounded overflow-x-auto max-h-[50vh]" dir="auto">
                {diffLines(p.currentContent, p.proposedContent).filter((d, k, all) => d.type !== ' ' || all.slice(Math.max(0, k - 2), k + 3).some((n) => n.type !== ' ')).map((d, k) => (
                  <div key={k} className={d.type === '+' ? 'bg-green-100' : d.type === '-' ? 'bg-red-100 line-through' : ''}>{d.type} {d.line}</div>
                ))}
              </pre>
            )}
            {p.status === 'awaiting_approval' && (
              <div className="flex gap-2 mt-3">
                <button disabled={busy} onClick={() => decideProposal(p, 'approve')} className="px-3 py-1.5 text-xs rounded-md bg-green-700 text-white">Approve &amp; activate</button>
                <button disabled={busy} onClick={() => decideProposal(p, 'reject')} className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)]">Reject</button>
              </div>
            )}
          </div>
        ))
        : (items as Correction[]).map((c) => (
          <div key={c.id} className="bg-white border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className={`px-1.5 rounded ${TIER_STYLE[c.riskTier ?? ''] ?? ''}`}>{c.riskTier ?? '?'}</span>
              <span className="text-[var(--text-sec)]">{c.category} · {c.targetSkill} · {c.status} · {c.userId ? 'signed-in user' : 'anonymous'} · {new Date(c.createdAt).toLocaleString()}</span>
            </div>
            {c.summary && <p className="text-sm font-medium mt-2">{c.summary}</p>}
            <p className="text-sm mt-1 whitespace-pre-wrap" dir="auto">“{c.text}”</p>
            {c.reviewNote && <p className="text-xs text-[var(--text-sec)] mt-1">{c.reviewNote}</p>}
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="text-xs text-[var(--primary)] mt-2">{open === c.id ? 'Hide' : 'Show question & answer'}</button>
            {open === c.id && (
              <div className="mt-2 text-xs bg-[var(--surface-alt)] p-3 rounded max-h-[40vh] overflow-y-auto whitespace-pre-wrap" dir="auto">
                <b>Q:</b> {c.question}{'\n\n'}<b>A:</b> {c.answer}
              </div>
            )}
            {(c.status === 'triaged' || c.status === 'reviewer_approved') && c.riskTier !== 'low' && (
              <div className="flex gap-2 mt-3">
                <button disabled={busy} onClick={() => decide(c.id, 'accept')} className="px-3 py-1.5 text-xs rounded-md bg-[var(--primary)] text-white">Accept (send to learning loop)</button>
                <button disabled={busy} onClick={() => decide(c.id, 'reject')} className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)]">Reject</button>
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

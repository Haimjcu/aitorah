'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

interface QaPair {
  id: string
  question: string
  answerMarkdown: string
  sourceRefs: string[]
  categories: string[] | null
  topics: string[] | null
  slug: string | null
  viewCount: number | null
  aiScore: number | null
  aiScoreReasons: {
    answerLength: number
    sourceCount: number
    specificity: number
    uniqueness: number
    categoryCoverage: number
  } | null
  featuredImageUrl: string | null
  createdAt: string
  status: string
}

type Tab = 'pending' | 'approved' | 'rejected'

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const color = score >= 70 ? 'text-green-700 bg-green-100' : score >= 40 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${color}`}>{score}/100</span>
}

function ScoreBreakdown({ reasons }: { reasons: QaPair['aiScoreReasons'] }) {
  if (!reasons) return null
  const items = [
    { label: 'Answer length', value: reasons.answerLength, max: 20 },
    { label: 'Sources', value: reasons.sourceCount, max: 25 },
    { label: 'Specificity', value: reasons.specificity, max: 20 },
    { label: 'Uniqueness', value: reasons.uniqueness, max: 20 },
    { label: 'Category coverage', value: reasons.categoryCoverage, max: 15 },
  ]
  return (
    <div className="grid grid-cols-5 gap-2 mt-2">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="text-xs text-[var(--text-sec)]">{item.label}</div>
          <div className="text-sm font-semibold">{item.value}<span className="text-xs text-[var(--text-sec)]">/{item.max}</span></div>
        </div>
      ))}
    </div>
  )
}

function ExpandedCard({
  item,
  onAction,
  onSave,
  onGenerateImage,
  onRegenerate,
  acting,
}: {
  item: QaPair
  onAction: (id: string, action: string) => void
  onSave: (id: string, edits: { question: string; answerMarkdown: string }) => void
  onGenerateImage: (id: string) => void
  onRegenerate: (id: string) => void
  acting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editQuestion, setEditQuestion] = useState(item.question)
  const [editAnswer, setEditAnswer] = useState(item.answerMarkdown)

  return (
    <div className="bg-white border border-[var(--border)] rounded-lg px-6 py-5 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <ScoreBadge score={item.aiScore} />
            <span className="text-xs text-[var(--text-sec)]">
              {new Date(item.createdAt).toLocaleDateString()} · {item.sourceRefs.length} sources · {item.answerMarkdown.length} chars
            </span>
          </div>
          {editing ? (
            <textarea
              value={editQuestion}
              onChange={(e) => setEditQuestion(e.target.value)}
              className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm font-serif font-bold text-[var(--primary)] mb-2"
              rows={2}
            />
          ) : (
            <h1 className="text-xl font-serif font-bold text-[var(--primary)]">{item.question}</h1>
          )}
          {item.slug && (
            <div className="mt-1 text-xs text-[var(--text-sec)] font-mono">
              /answers/{item.slug}
            </div>
          )}
        </div>
      </div>

      <ScoreBreakdown reasons={item.aiScoreReasons} />

      {item.categories && item.categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-3 mb-3">
          {item.categories.map((c) => (
            <span key={c} className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-2 py-0.5 rounded">{c}</span>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-3 mt-3">
        <div className="text-xs font-semibold text-[var(--text-sec)] mb-1.5">Sources</div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {item.sourceRefs.map((ref) => (
            <a
              key={ref}
              href={`https://www.sefaria.org/${ref.replace(/ /g, '_')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-text)] hover:underline"
            >
              {ref}
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3 mt-1">
        <div className="text-xs font-semibold text-[var(--text-sec)] mb-1.5">Answer preview</div>
        {editing ? (
          <textarea
            value={editAnswer}
            onChange={(e) => setEditAnswer(e.target.value)}
            className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm leading-relaxed font-mono"
            rows={12}
          />
        ) : (
          <div className="prose prose-sm prose-slate max-w-none max-h-[400px] overflow-y-auto
            prose-headings:font-serif prose-headings:text-[var(--primary)]
            prose-p:text-[var(--text)] prose-p:leading-relaxed
            prose-a:text-[var(--primary-light)] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[var(--text)]
            prose-blockquote:border-l-[var(--accent)] prose-blockquote:text-[var(--text-sec)]
          ">
            <ReactMarkdown>{item.answerMarkdown}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Featured image */}
      <div className="border-t border-[var(--border)] pt-3 mt-3">
        <div className="text-xs font-semibold text-[var(--text-sec)] mb-1.5">Featured image</div>
        {item.featuredImageUrl ? (
          <div className="rounded-lg overflow-hidden border border-[var(--border)]">
            <img src={item.featuredImageUrl} alt={item.question} className="w-full h-auto" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-xs text-[var(--text-sec)]">No image yet.</p>
            {item.status === 'pending' && (
              <button
                onClick={() => onGenerateImage(item.id)}
                disabled={acting}
                className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-lg hover:bg-[var(--accent-dark)] disabled:opacity-50 transition-colors"
              >
                {acting ? 'Generating...' : 'Generate Image'}
              </button>
            )}
          </div>
        )}
        {item.featuredImageUrl && item.status === 'pending' && (
          <button
            onClick={() => onGenerateImage(item.id)}
            disabled={acting}
            className="mt-2 px-3 py-1.5 bg-[var(--surface-alt)] text-[var(--text-sec)] text-xs font-medium rounded-lg hover:bg-[var(--border)] disabled:opacity-50 transition-colors"
          >
            {acting ? 'Generating...' : 'Regenerate Image'}
          </button>
        )}
      </div>

      {item.status === 'pending' && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-[var(--border)]">
          {editing ? (
            <>
              <button
                onClick={() => onSave(item.id, { question: editQuestion, answerMarkdown: editAnswer })}
                disabled={acting}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditQuestion(item.question)
                  setEditAnswer(item.answerMarkdown)
                  setEditing(false)
                }}
                className="px-4 py-2 bg-[var(--surface-alt)] text-[var(--text-sec)] text-sm font-medium rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onAction(item.id, 'approve')}
                disabled={acting}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onAction(item.id, 'reject')}
                disabled={acting}
                className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-[var(--surface-alt)] text-[var(--text-sec)] text-sm font-medium rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onRegenerate(item.id)}
                disabled={acting}
                className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {acting ? 'Regenerating...' : 'Regenerate Answer'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function ReviewQueue() {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<QaPair[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/queue?status=${tab}&page=${page}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setTotal(data.total)
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleAction = async (id: string, action: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/qa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
        setTotal((prev) => prev - 1)
        setExpandedId(null)
      }
    } finally {
      setActing(false)
    }
  }

  const handleSave = async (id: string, edits: { question: string; answerMarkdown: string }) => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/qa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...edits }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...data.item } : i))
      }
    } finally {
      setActing(false)
    }
  }

  const handleRegenerate = async (id: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/qa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...data.item } : i))
      }
    } finally {
      setActing(false)
    }
  }

  const handleGenerateImage = async (id: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/qa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-image' }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems((prev) => prev.map((i) =>
          i.id === id ? { ...i, featuredImageUrl: data.featuredImageUrl } : i
        ))
      }
    } finally {
      setActing(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); setExpandedId(null) }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-sec)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
            {tab === t.key && !loading && <span className="ml-1.5 text-xs">({total})</span>}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="flex gap-1 justify-center mb-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-[var(--primary-light)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm text-[var(--text-sec)]">Loading...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--text-sec)]">
            {tab === 'pending' ? 'No pending Q&A pairs to review.' : `No ${tab} Q&A pairs.`}
          </p>
        </div>
      )}

      {/* Items */}
      {!loading && items.map((item) => (
        expandedId === item.id ? (
          <ExpandedCard key={item.id} item={item} onAction={handleAction} onSave={handleSave} onGenerateImage={handleGenerateImage} onRegenerate={handleRegenerate} acting={acting} />
        ) : (
          <button
            key={item.id}
            onClick={() => setExpandedId(item.id)}
            className="w-full text-left bg-white border border-[var(--border)] rounded-lg px-6 py-4 mb-2 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ScoreBadge score={item.aiScore} />
                  {item.categories?.slice(0, 3).map((c) => (
                    <span key={c} className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
                <h3 className="font-serif font-bold text-sm text-[var(--primary)] truncate">{item.question}</h3>
                <p className="text-xs text-[var(--text-sec)] mt-0.5">
                  {item.sourceRefs.length} sources · {item.answerMarkdown.length} chars · {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-sec)] flex-shrink-0 ml-3">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        )
      ))}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg disabled:opacity-30 hover:bg-[var(--surface-alt)] transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--text-sec)]">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg disabled:opacity-30 hover:bg-[var(--surface-alt)] transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

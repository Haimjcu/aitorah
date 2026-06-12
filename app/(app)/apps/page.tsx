'use client'

import { useState } from 'react'
import { BuildingBanner } from '@/components/ui/BuildingBanner'

const APPS = [
  { emoji: '📖', name: 'Sefaria GPT', status: 'Live', statusClass: 'bg-green-100 text-green-700', desc: "Ask questions over Sefaria's full library with GPT-4. Citation-level accuracy with linked source references.", tags: ['Sefaria', 'GPT-4', 'Study'] },
  { emoji: '⚖️', name: 'HalachaBot', status: 'Beta', statusClass: 'bg-blue-100 text-blue-700', desc: 'Halachic guidance sourced from Shulchan Aruch and contemporary poskim. Educational only.', tags: ['Halacha', 'Claude', 'LangChain'] },
  { emoji: '🎓', name: 'Parasha Tutor', status: 'OSS', statusClass: 'bg-[var(--accent-light)] text-[var(--accent-text)]', desc: 'Weekly parasha study guide generator with custom levels from child-friendly to advanced beit midrash.', tags: ['Education', 'Open Source'] },
  { emoji: '🔍', name: 'Talmud Semantic Search', status: 'Live', statusClass: 'bg-green-100 text-green-700', desc: 'Search all of Shas by semantic meaning. Built on pgvector with Aramaic+Hebrew support.', tags: ['pgvector', 'Talmud', 'Search'] },
  { emoji: '🎨', name: 'Torah Art Generator', status: 'Beta', statusClass: 'bg-blue-100 text-blue-700', desc: 'Generate illustrated midrash scenes and parasha artwork using DALL-E with halachic image guidelines.', tags: ['DALL-E', 'Art', 'Creative'] },
  { emoji: '📊', name: 'Torah Text Embeddings', status: 'OSS', statusClass: 'bg-[var(--accent-light)] text-[var(--accent-text)]', desc: 'Open dataset: 50k Torah passage embeddings (OpenAI ada-002). Plug into your own RAG pipeline.', tags: ['Dataset', 'Embeddings', 'RAG'] },
]

const CATEGORIES = ['Study Tools', 'Halacha', 'Education', 'Datasets', 'APIs & Tools', 'Creative']
const STATUSES = ['Live', 'Beta', 'Open Source']

export default function AppsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('Featured')

  const filtered = APPS.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BuildingBanner />
      <div className="px-7 py-4 border-b border-[var(--border)] bg-white flex items-center justify-between flex-shrink-0">
        <h1 className="font-serif text-xl font-bold text-[var(--primary)]">App Directory</h1>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-dark)] transition-all">Submit Your App</button>
          <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-semibold">HL</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-7">
        <div className="flex gap-7">
          {/* Filter sidebar */}
          <div className="w-48 flex-shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search apps..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--primary-light)] transition-colors"
            />
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-sec)] mb-2">Category</h3>
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2 py-1 cursor-pointer text-sm text-[var(--text-sec)] hover:text-[var(--text)]">
                  <input type="checkbox" defaultChecked={c === 'Study Tools'} className="accent-[var(--primary)]" />
                  {c}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-sec)] mb-2">Status</h3>
              {STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 py-1 cursor-pointer text-sm text-[var(--text-sec)] hover:text-[var(--text)]">
                  <input type="checkbox" defaultChecked className="accent-[var(--primary)]" />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">
                All Apps <span className="text-[var(--text-sec)] font-normal text-sm">— {filtered.length} results</span>
              </h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-[var(--border)] rounded-md px-3 py-1.5 text-sm bg-white text-[var(--text)] outline-none"
              >
                <option>Sort: Featured</option>
                <option>Sort: Newest</option>
                <option>Sort: A–Z</option>
              </select>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((app) => (
                <div key={app.name} className="bg-white border border-[var(--border)] rounded-lg p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--primary-light)] transition-all">
                  <div className="flex items-start justify-between mb-3.5">
                    <div className="w-11 h-11 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] flex items-center justify-center text-xl">{app.emoji}</div>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${app.statusClass}`}>{app.status}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1.5">{app.name}</h3>
                  <p className="text-xs text-[var(--text-sec)] leading-snug mb-3">{app.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {app.tags.map((t) => (
                      <span key={t} className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

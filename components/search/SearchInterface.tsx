'use client'

import { useState } from 'react'

type Result = {
  ref: string
  type: string
  source: string
  similarity: number
  hebrew: string
  english: string
  sefaria_url?: string
}

const FILTERS = ['All Texts', 'Tanakh', 'Mishnah', 'Gemara', 'Rishonim', 'Acharonim']

export function SearchInterface() {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All Texts')
  const [results, setResults] = useState<Result[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [total, setTotal] = useState(0)

  const handleSearch = async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams({ q: query, limit: '20' })
      if (activeFilter !== 'All Texts') params.set('source', activeFilter.toLowerCase())
      const res = await fetch(`/api/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
      }
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  if (!hasSearched) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-full max-w-[760px] text-center">
          <h2 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">Torah Search</h2>
          <p className="text-sm text-[var(--text-sec)] mb-6">Search across the Sefaria library — Tanakh, Talmud, Midrash, Halakhah, and more.</p>

          <div className="flex bg-white border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-[var(--primary-light)] transition-colors mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search Torah texts — try a topic, reference, or question..."
              className="flex-1 border-none outline-none px-4 py-3 text-sm font-sans"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex items-center gap-1.5 px-5 bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] disabled:opacity-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap justify-center mb-5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-all ${activeFilter === f ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <p className="text-xs text-[var(--text-sec)]">Powered by Sefaria&apos;s ElasticSearch with Hebrew morphological analysis.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[760px]">
      {/* Search bar */}
      <div className="flex bg-white border border-[var(--border)] rounded-xl overflow-hidden focus-within:border-[var(--primary-light)] transition-colors mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search Torah texts — try a topic, reference, or question..."
          className="flex-1 border-none outline-none px-4 py-3 text-sm font-sans"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="flex items-center gap-1.5 px-5 bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] disabled:opacity-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setActiveFilter(f); if (hasSearched) setTimeout(handleSearch, 0) }}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${activeFilter === f ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {hasSearched && !isSearching && (
        <p className="text-sm text-[var(--text-sec)] mb-4">
          {results.length > 0
            ? <>Showing {results.length} of {total} results for <strong>&quot;{query}&quot;</strong></>
            : <>No results found for <strong>&quot;{query}&quot;</strong>. Try a different search term.</>
          }
        </p>
      )}

      {isSearching && (
        <div className="text-center py-12">
          <div className="flex gap-1 justify-center mb-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-[var(--primary-light)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm text-[var(--text-sec)]">Searching Sefaria...</p>
        </div>
      )}

      {/* Results */}
      {results.map((r) => (
        <div key={r.ref} className="bg-white border border-[var(--border)] rounded-lg px-6 py-5 mb-3 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-serif font-bold text-sm text-[var(--primary)]">{r.ref}</div>
              <div className="text-xs text-[var(--text-sec)] mt-0.5">{r.type}</div>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">{r.similarity}% relevance</span>
          </div>
          {r.hebrew && <div className="hebrew text-lg mb-2 leading-loose">{r.hebrew}</div>}
          {r.english && <div className="text-sm text-[var(--text-sec)] leading-relaxed mb-3">{r.english}</div>}
          <div className="flex gap-2">
            <span className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-2 py-1 rounded">{r.source}</span>
            <a
              href={r.sefaria_url ?? `https://www.sefaria.org/${r.ref.replace(/ /g, '_')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1 text-xs text-[var(--text-sec)] hover:bg-[var(--surface-alt)] rounded transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              View on Sefaria
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

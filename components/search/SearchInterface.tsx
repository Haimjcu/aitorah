'use client'

import { useState } from 'react'

type Result = {
  ref: string
  type: string
  source: string
  similarity: number
  hebrew: string
  english: string
}

const MOCK_RESULTS: Result[] = [
  { ref: 'Bava Metzia 49a', type: 'Gemara · Talmud Bavli', source: 'Gemara', similarity: 96, hebrew: 'כָּל הַחוֹזֵר בּוֹ, אֵין רוּחַ חֲכָמִים נוֹחָה הֵימֶנּוּ', english: '"Whoever retracts [from a verbal commitment in business], the spirit of the Sages is not pleased with him."' },
  { ref: 'Shabbat 55a', type: 'Gemara · Talmud Bavli', source: 'Gemara', similarity: 91, hebrew: 'חוֹתָמוֹ שֶׁל הַקָּדוֹשׁ בָּרוּךְ הוּא אֱמֶת', english: '"The seal of the Holy One, Blessed be He, is truth (emet)."' },
  { ref: 'Mishlei 23:23', type: 'Tanakh · Ketuvim', source: 'Tanakh', similarity: 88, hebrew: 'אֱמֶת קְנֵה וְאַל-תִּמְכֹּר חָכְמָה וּמוּסָר וּבִינָה', english: '"Buy truth and do not sell it — also wisdom, discipline and understanding."' },
]

const FILTERS = ['All Texts', 'Tanakh', 'Mishnah', 'Gemara', 'Rishonim', 'Acharonim']

export function SearchInterface() {
  const [query, setQuery] = useState('honesty in business dealings')
  const [activeFilter, setActiveFilter] = useState('All Texts')
  const [results, setResults] = useState<Result[]>(MOCK_RESULTS)
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setIsSearching(true)
    try {
      const params = new URLSearchParams({ q: query, limit: '10' })
      if (activeFilter !== 'All Texts') params.set('source', activeFilter.toLowerCase())
      const res = await fetch(`/api/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? MOCK_RESULTS)
      }
    } catch {
      // keep mock data on error
    } finally {
      setIsSearching(false)
    }
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
          placeholder="Search by meaning, not keywords..."
          className="flex-1 border-none outline-none px-4 py-3 text-sm font-sans"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="flex items-center gap-1.5 px-5 bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] disabled:opacity-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
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

      <p className="text-sm text-[var(--text-sec)] mb-4">
        Showing {results.length} results for <strong>"{query}"</strong>
      </p>

      {/* Results */}
      {results.map((r) => (
        <div key={r.ref} className="bg-white border border-[var(--border)] rounded-lg px-6 py-5 mb-3 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-serif font-bold text-sm text-[var(--primary)]">{r.ref}</div>
              <div className="text-xs text-[var(--text-sec)] mt-0.5">{r.type}</div>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">{r.similarity}% match</span>
          </div>
          <div className="hebrew text-lg mb-2 leading-loose">{r.hebrew}</div>
          <div className="text-sm text-[var(--text-sec)] leading-relaxed mb-3">{r.english}</div>
          <div className="flex gap-2">
            <span className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-2 py-1 rounded">{r.source}</span>
            <button className="flex items-center gap-1 px-3 py-1 text-xs text-[var(--text-sec)] hover:bg-[var(--surface-alt)] rounded transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Ask Study Partner
            </button>
            <button className="flex items-center gap-1 px-3 py-1 text-xs text-[var(--text-sec)] hover:bg-[var(--surface-alt)] rounded transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              View on Sefaria
            </button>
          </div>
        </div>
      ))}

      <div className="text-center py-5 text-sm text-[var(--text-sec)]">
        Showing {results.length} of 12 results ·{' '}
        <button className="text-[var(--primary-light)] hover:underline">Load more</button>
      </div>
    </div>
  )
}

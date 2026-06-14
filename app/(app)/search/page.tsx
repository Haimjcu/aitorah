import type { Metadata } from 'next'
import { SearchInterface } from '@/components/search/SearchInterface'
import { BuildingBanner } from '@/components/ui/BuildingBanner'

export const metadata: Metadata = { title: 'Torah Search — AI Torah' }

export default function SearchPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-7 py-4 border-b border-[var(--border)] bg-white flex items-center justify-between flex-shrink-0">
        <h1 className="font-serif text-xl font-bold text-[var(--primary)]">Torah Search</h1>
        <span className="text-sm text-[var(--text-sec)]">Sefaria Library · Full-text search with Hebrew morphology</span>
      </div>
      <div className="flex-1 overflow-y-auto p-7">
        <SearchInterface />
      </div>
    </div>
  )
}

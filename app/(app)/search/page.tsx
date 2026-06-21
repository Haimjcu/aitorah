import type { Metadata } from 'next'
import { SearchInterface } from '@/components/search/SearchInterface'
import { AppPageHeader } from '@/components/layout/AppPageHeader'

export const metadata: Metadata = {
  title: 'Torah Search',
  description: 'Search across the Sefaria library — Tanakh, Talmud, Midrash, and Halakhah. Full-text search with Hebrew morphological analysis and category filtering.',
  alternates: { canonical: '/search' },
}

export default function SearchPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AppPageHeader title="Torah Search">
        <span className="text-sm text-[var(--text-sec)]">Sefaria Library · Full-text search with Hebrew morphology</span>
      </AppPageHeader>
      <div className="flex-1 overflow-y-auto p-7">
        <SearchInterface />
      </div>
    </div>
  )
}

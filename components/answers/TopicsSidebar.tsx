import Link from 'next/link'
import { CATEGORIES, categoryNameToSlug } from '@/lib/categories'

interface TopicsSidebarProps {
  categoryStats: { category: string; count: number }[]
  activeCategory?: string | null
  mobile?: boolean
}

export function TopicsSidebar({ categoryStats, activeCategory, mobile }: TopicsSidebarProps) {
  const statMap = new Map(categoryStats.map((s) => [s.category, s.count]))
  const isAll = !activeCategory

  if (mobile) {
    return (
      <div className="md:hidden mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-sec)] mb-3">Topics</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/answers"
            className={`px-3 py-2 rounded-lg text-sm text-center border transition-all ${
              isAll
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
            }`}
          >
            All Questions
          </Link>
          {CATEGORIES.map((cat) => {
            const count = statMap.get(cat.name) ?? 0
            if (count === 0) return null
            const isActive = activeCategory === cat.name
            return (
              <Link
                key={cat.slug}
                href={`/topics/${cat.slug}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                  isActive
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <span className={`text-xs ml-1 flex-shrink-0 ${isActive ? 'text-white/70' : 'text-[var(--text-sec)]/60'}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <nav className="w-[220px] flex-shrink-0 flex flex-col gap-0.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-sec)] px-3 mb-2">Topics</h3>
      <Link
        href="/answers"
        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          isAll
            ? 'bg-[#eef2ff] text-[var(--primary)]'
            : 'text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]'
        }`}
      >
        All Questions
      </Link>
      {CATEGORIES.map((cat) => {
        const count = statMap.get(cat.name) ?? 0
        const isActive = activeCategory === cat.name
        return (
          <Link
            key={cat.slug}
            href={`/topics/${cat.slug}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
              isActive
                ? 'bg-[#eef2ff] text-[var(--primary)] font-medium'
                : count > 0
                  ? 'text-[var(--text-sec)] hover:bg-[var(--surface-alt)] hover:text-[var(--text)]'
                  : 'text-[var(--text-sec)]/40 pointer-events-none'
            }`}
          >
            <span className="truncate">{cat.name}</span>
            {count > 0 && (
              <span className={`text-xs ml-2 flex-shrink-0 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-sec)]'}`}>
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

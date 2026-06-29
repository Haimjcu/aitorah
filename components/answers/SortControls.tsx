import Link from 'next/link'

interface SortControlsProps {
  currentSort: 'date' | 'views'
  basePath: string
}

const SORTS = [
  { key: 'date' as const, label: 'Newest' },
  { key: 'views' as const, label: 'Most Viewed' },
]

export function SortControls({ currentSort, basePath }: SortControlsProps) {
  return (
    <div className="flex gap-2 mb-6">
      {SORTS.map((s) => {
        const isActive = currentSort === s.key
        const href = s.key === 'date' ? basePath : `${basePath}?sort=views`
        return (
          <Link
            key={s.key}
            href={href}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
              isActive
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
            }`}
          >
            {s.label}
          </Link>
        )
      })}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { CATEGORIES, categoryNameToSlug } from '@/lib/categories'
import { getPublishedQaPairs, getCategoryStats } from '@/lib/db/qa'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Torah Q&A — AI Torah',
  description: 'Browse answered Torah questions with cited sources from Tanakh, Talmud, Midrash, Halakhah, and more.',
  alternates: { canonical: '/answers' },
}

const FILTERS = ['All', ...CATEGORIES.map((c) => c.name)]

type Props = { searchParams: Promise<{ category?: string; page?: string }> }

export default async function AnswersPage({ searchParams }: Props) {
  const sp = await searchParams
  const category = sp.category
  const page = Math.max(1, parseInt(sp.page ?? '1'))

  if (!process.env.DATABASE_URL) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-3">Torah Q&A</h1>
        <p className="text-[var(--text-sec)]">No answers published yet. Check back soon.</p>
      </div>
    )
  }

  const [data, categoryStats] = await Promise.all([
    getPublishedQaPairs({ category, page, limit: 20 }),
    getCategoryStats(),
  ])

  const statMap = new Map(categoryStats.map(c => [c.category, c.count]))
  const totalPublished = categoryStats.reduce((sum, c) => sum + c.count, 0)
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">Torah Q&A</h1>
      <p className="text-sm text-[var(--text-sec)] mb-6">
        {totalPublished} answered questions with cited sources from the Sefaria library.
      </p>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-8">
        {FILTERS.map((f) => {
          const count = f === 'All' ? totalPublished : (statMap.get(f) ?? 0)
          if (f !== 'All' && count === 0) return null
          const isActive = f === 'All' ? !category : category === f
          const href = f === 'All' ? '/answers' : `/answers?category=${encodeURIComponent(f)}`
          return (
            <Link
              key={f}
              href={href}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm border transition-all ${
                isActive
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-white border-[var(--border)] text-[var(--text-sec)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
              }`}
            >
              {f}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                isActive ? 'bg-white/25 text-white' : 'bg-[var(--surface-alt)] text-[var(--text-sec)]'
              }`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Results */}
      {data.items.length === 0 ? (
        <p className="text-center text-[var(--text-sec)] py-12">
          {category ? `No answers in ${category} yet.` : 'No answers published yet. Check back soon.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map((item) => (
            <Link
              key={item.slug}
              href={`/answers/${item.slug}`}
              className="bg-white border border-[var(--border)] rounded-lg px-6 py-5 hover:shadow-md transition-shadow block"
            >
              <h2 className="font-serif font-bold text-[var(--primary)] mb-1.5">{item.question}</h2>
              {item.metaDescription && (
                <p className="text-sm text-[var(--text-sec)] leading-relaxed mb-3 line-clamp-2">{item.metaDescription}</p>
              )}
              <div className="flex gap-2 items-center flex-wrap">
                {item.categories?.slice(0, 3).map((c) => (
                  <span key={c} className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-2 py-0.5 rounded">{c}</span>
                ))}
                {item.viewCount != null && item.viewCount > 0 && (
                  <span className="text-xs text-[var(--text-sec)]">{item.viewCount} views</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={`/answers?${category ? `category=${encodeURIComponent(category)}&` : ''}page=${page - 1}`}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-alt)] transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-[var(--text-sec)]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/answers?${category ? `category=${encodeURIComponent(category)}&` : ''}page=${page + 1}`}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-alt)] transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

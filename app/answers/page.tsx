import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedQaPairs, getCategoryStats } from '@/lib/db/qa'
import { QaPageLayout } from '@/components/answers/QaPageLayout'
import { SortControls } from '@/components/answers/SortControls'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Torah Q&A — AI Torah',
  description: 'Browse answered Torah questions with cited sources from Tanakh, Talmud, Midrash, Halakhah, and more.',
  alternates: { canonical: '/answers' },
}

type Props = { searchParams: Promise<{ page?: string; sort?: string }> }

export default async function AnswersPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1'))
  const sort: 'date' | 'views' = sp.sort === 'views' ? 'views' : 'date'

  if (!process.env.DATABASE_URL) {
    return (
      <div className="max-w-[800px] mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-3">Torah Q&A</h1>
        <p className="text-[var(--text-sec)]">No answers published yet. Check back soon.</p>
      </div>
    )
  }

  const [data, categoryStats] = await Promise.all([
    getPublishedQaPairs({ page, limit: 30, sort }),
    getCategoryStats(),
  ])

  const totalPublished = categoryStats.reduce((sum, c) => sum + c.count, 0)
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aitorah.ai' },
      { '@type': 'ListItem', position: 2, name: 'Torah Q&A' },
    ],
  }

  const sortParam = sort !== 'date' ? `sort=${sort}` : ''

  return (
    <QaPageLayout categoryStats={categoryStats}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">Torah Q&A</h1>
      <p className="text-sm text-[var(--text-sec)] mb-6">
        {totalPublished} answered questions with cited sources from the Sefaria library.
      </p>

      <SortControls currentSort={sort} basePath="/answers" />

      {data.items.length === 0 ? (
        <p className="text-center text-[var(--text-sec)] py-12">
          No answers published yet. Check back soon.
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={`/answers?${[sortParam, `page=${page - 1}`].filter(Boolean).join('&')}`}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-alt)] transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-[var(--text-sec)]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/answers?${[sortParam, `page=${page + 1}`].filter(Boolean).join('&')}`}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-alt)] transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </QaPageLayout>
  )
}

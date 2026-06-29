import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { getPublishedQaPairs, getCategoryStats } from '@/lib/db/qa'
import { QaPageLayout } from '@/components/answers/QaPageLayout'
import { SortControls } from '@/components/answers/SortControls'

export const revalidate = 1800

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; sort?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return {}

  return {
    title: `${cat.name} — Torah Q&A — AI Torah`,
    description: cat.description,
    alternates: { canonical: `/topics/${slug}` },
  }
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const page = Math.max(1, parseInt(sp.page ?? '1'))
  const sort: 'date' | 'views' = sp.sort === 'views' ? 'views' : 'date'

  const [data, allStats] = await Promise.all([
    getPublishedQaPairs({ category: cat.name, page, limit: 30, sort }),
    getCategoryStats(),
  ])

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${cat.name} — Torah Q&A`,
    description: cat.description,
    url: `https://aitorah.ai/topics/${slug}`,
    publisher: { '@type': 'Organization', name: 'AI Torah', url: 'https://aitorah.ai' },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aitorah.ai' },
      { '@type': 'ListItem', position: 2, name: 'Topics', item: 'https://aitorah.ai/topics' },
      { '@type': 'ListItem', position: 3, name: cat.name },
    ],
  }

  const basePath = `/topics/${slug}`
  const sortParam = sort !== 'date' ? `sort=${sort}` : ''

  return (
    <QaPageLayout categoryStats={allStats} activeCategory={cat.name}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <nav className="flex items-center gap-1.5 text-xs text-[var(--text-sec)] mb-6">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/topics" className="hover:text-[var(--primary)] transition-colors">Topics</Link>
        <span>/</span>
        <span className="text-[var(--text)]">{cat.name}</span>
      </nav>

      <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">{cat.name}</h1>
      <p className="text-sm text-[var(--text-sec)] mb-2">{cat.description}</p>
      <p className="text-xs text-[var(--text-sec)] mb-6">
        {data.total} {data.total === 1 ? 'question' : 'questions'} answered
      </p>

      <SortControls currentSort={sort} basePath={basePath} />

      {data.items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--text-sec)] mb-4">No answered questions in {cat.name} yet.</p>
          <Link
            href="/study"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors"
          >
            Ask a {cat.name} Question
          </Link>
        </div>
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
                {item.categories?.filter((c) => c !== cat.name).slice(0, 3).map((c) => (
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
              href={`${basePath}?${[sortParam, `page=${page - 1}`].filter(Boolean).join('&')}`}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-alt)] transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-[var(--text-sec)]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`${basePath}?${[sortParam, `page=${page + 1}`].filter(Boolean).join('&')}`}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-alt)] transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}

      <div className="mt-10 text-center border-t border-[var(--border)] pt-8">
        <p className="text-sm text-[var(--text-sec)] mb-3">Have a different question?</p>
        <Link
          href="/study"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors"
        >
          Ask AI Torah
        </Link>
      </div>
    </QaPageLayout>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { getCategoryStats } from '@/lib/db/qa'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Torah Topics — AI Torah',
  description: 'Explore Torah topics across Tanakh, Talmud, Midrash, Halakhah, Kabbalah, Chasidut, and more — with source-cited answers.',
  alternates: { canonical: '/topics' },
}

export default async function TopicsPage() {
  const stats = await getCategoryStats()
  const statMap = new Map(stats.map((s) => [s.category, s.count]))
  const totalPublished = stats.reduce((sum, s) => sum + s.count, 0)

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aitorah.ai' },
      { '@type': 'ListItem', position: 2, name: 'Topics' },
    ],
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">Torah Topics</h1>
      <p className="text-sm text-[var(--text-sec)] mb-8">
        {totalPublished} answered questions across {stats.length} categories from the Sefaria library.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => {
          const count = statMap.get(cat.name) ?? 0
          return (
            <Link
              key={cat.slug}
              href={`/topics/${cat.slug}`}
              className="group border border-[var(--border)] rounded-lg p-5 hover:shadow-md hover:border-[var(--primary)] transition-all bg-white"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-serif font-bold text-[var(--primary)] group-hover:text-[var(--primary-light)] transition-colors">
                  {cat.name}
                </h2>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-semibold bg-[var(--surface-alt)] text-[var(--text-sec)]">
                    {count}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-sec)] leading-relaxed">
                {cat.description}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="mt-10 text-center border-t border-[var(--border)] pt-8">
        <p className="text-sm text-[var(--text-sec)] mb-3">Can&apos;t find what you&apos;re looking for?</p>
        <Link
          href="/study"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors"
        >
          Ask AI Torah
        </Link>
      </div>
    </div>
  )
}

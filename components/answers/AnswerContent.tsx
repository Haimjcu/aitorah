'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { categoryNameToSlug } from '@/lib/categories'

interface QaPair {
  question: string
  answerMarkdown: string
  sourceRefs: string[]
  categories: string[] | null
  topics: string[] | null
  publishedAt: Date | null
  createdAt: Date | null
  featuredImageUrl: string | null
  viewCount: number | null
}

interface RelatedItem {
  slug: string | null
  question: string
  categories: string[] | null
  metaDescription: string | null
}

export function AnswerContent({ qa, related, slug }: { qa: QaPair; related: RelatedItem[]; slug: string }) {
  const publishDate = qa.publishedAt ?? qa.createdAt
  const router = useRouter()
  const [followUp, setFollowUp] = useState('')
  const [expandedPaa, setExpandedPaa] = useState<string | null>(null)

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUp.trim()) return
    router.push(`/study?q=${encodeURIComponent(followUp.trim())}`)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/answers/${slug}/view`, { method: 'POST' }).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [slug])

  return (
    <article className="py-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--text-sec)] mb-6">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/answers" className="hover:text-[var(--primary)] transition-colors">Q&A</Link>
        {qa.categories?.[0] && (
          <>
            <span>/</span>
            <Link
              href={`/topics/${categoryNameToSlug(qa.categories[0])}`}
              className="hover:text-[var(--primary)] transition-colors"
            >
              {qa.categories[0]}
            </Link>
          </>
        )}
      </nav>

      {/* Question */}
      <h1 className="text-2xl md:text-3xl font-serif font-bold text-[var(--primary)] leading-snug mb-4">
        {qa.question}
      </h1>

      {/* Meta line */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-sec)] mb-6 pb-6 border-b border-[var(--border)]">
        <span>By AI Torah</span>
        {publishDate && (
          <span>{new Date(publishDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        )}
        <span>{qa.sourceRefs.length} sources cited</span>
        {qa.viewCount != null && qa.viewCount > 0 && <span>{qa.viewCount} views</span>}
      </div>

      {/* Featured image */}
      {qa.featuredImageUrl && (
        <div className="mb-8 rounded-lg overflow-hidden">
          <img src={qa.featuredImageUrl} alt={qa.question} className="w-full h-auto" />
        </div>
      )}

      {/* Answer body */}
      <div className="prose prose-slate max-w-none mb-8
        prose-headings:font-serif prose-headings:text-[var(--primary)]
        prose-p:text-[var(--text)] prose-p:leading-relaxed
        prose-a:text-[var(--primary-light)] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-[var(--text)]
        prose-blockquote:border-l-[var(--accent)] prose-blockquote:text-[var(--text-sec)]
      ">
        <ReactMarkdown>{qa.answerMarkdown}</ReactMarkdown>
      </div>

      {/* Sources */}
      <section className="border-t border-[var(--border)] pt-6 mb-8">
        <h2 className="text-lg font-serif font-bold text-[var(--primary)] mb-4">Sources</h2>
        <div className="grid gap-2">
          {qa.sourceRefs.map((ref) => (
            <a
              key={ref}
              href={`https://www.sefaria.org/${ref.replace(/ /g, '_')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg text-sm hover:border-[var(--primary)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-text)] flex-shrink-0">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <span className="font-medium text-[var(--accent-text)]">{ref}</span>
              <span className="text-[var(--text-sec)]">— View on Sefaria</span>
            </a>
          ))}
        </div>
      </section>

      {/* Categories */}
      {qa.categories && qa.categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-8">
          {qa.categories.map((c) => (
            <Link
              key={c}
              href={`/topics/${categoryNameToSlug(c)}`}
              className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-3 py-1 rounded-full border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {/* Related questions — accordion */}
      {related.length > 0 && (
        <section className="border-t border-[var(--border)] pt-6">
          <h2 className="text-lg font-serif font-bold text-[var(--primary)] mb-4">People Also Asked</h2>
          <div className="flex flex-col gap-1">
            {related.map((item) => {
              if (!item.slug) return null
              const isExpanded = expandedPaa === item.slug
              return (
                <div key={item.slug} className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedPaa(isExpanded ? null : item.slug)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left bg-white hover:bg-[var(--surface-alt)] transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-[var(--primary)] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--text)]">{item.question}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-[var(--surface-alt)]">
                      {item.metaDescription && (
                        <p className="text-sm text-[var(--text-sec)] leading-relaxed mb-3">{item.metaDescription}</p>
                      )}
                      <Link
                        href={`/answers/${item.slug}`}
                        className="text-sm font-medium text-[var(--primary-light)] hover:underline"
                      >
                        Read full answer &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Follow-up input */}
      <div className="mt-10 border-t border-[var(--border)] pt-8">
        <p className="text-sm text-[var(--text-sec)] mb-3 text-center">Want to dig deeper?</p>
        <form onSubmit={handleFollowUp} className="flex gap-2 max-w-xl mx-auto">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder={`Ask a follow-up about ${qa.categories?.[0]?.toLowerCase() ?? 'this topic'}...`}
            className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] bg-white"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors flex-shrink-0"
          >
            Ask
          </button>
        </form>
      </div>

      {/* Sticky mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[var(--border)] px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <form onSubmit={handleFollowUp} className="flex gap-2">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a follow-up..."
            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors flex-shrink-0"
          >
            Ask
          </button>
        </form>
      </div>
      {/* Spacer for sticky bar on mobile */}
      <div className="h-16 md:hidden" />
    </article>
  )
}

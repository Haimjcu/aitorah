import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPublishedQaBySlug, getRelatedQaPairs, getCategoryStats } from '@/lib/db/qa'
import { AnswerContent } from '@/components/answers/AnswerContent'
import { QaPageLayout } from '@/components/answers/QaPageLayout'
import { categoryNameToSlug } from '@/lib/categories'

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const qa = await getPublishedQaBySlug(slug)
  if (!qa || 'redirect' in qa) return {}

  const title = qa.metaTitle ?? `${qa.question} — AI Torah`
  const description = qa.metaDescription ?? qa.answerMarkdown.slice(0, 155).replace(/\n/g, ' ').trim()
  const url = `https://aitorah.ai/answers/${slug}`

  const ogImage = qa.featuredImageUrl
    ? { url: qa.featuredImageUrl, width: 1200, height: 800, type: 'image/webp' as const }
    : { url: 'https://aitorah.ai/opengraph-image.png', width: 1200, height: 630, type: 'image/png' as const }

  return {
    title,
    description,
    alternates: { canonical: `/answers/${slug}` },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'AI Torah',
      images: [ogImage],
    },
  }
}

export default async function AnswerPage({ params }: Props) {
  const { slug } = await params

  if (!process.env.DATABASE_URL) notFound()

  const qa = await getPublishedQaBySlug(slug)
  if (!qa) notFound()
  if ('redirect' in qa) redirect(`/answers/${qa.redirect}`)

  const [related, categoryStats] = await Promise.all([
    getRelatedQaPairs(qa.id, qa.categories),
    getCategoryStats(),
  ])

  const pageUrl = `https://aitorah.ai/answers/${slug}`
  const primaryCategory = qa.categories?.[0]
  const categorySlug = primaryCategory ? categoryNameToSlug(primaryCategory) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: qa.question,
      text: qa.question,
      dateCreated: qa.publishedAt ?? qa.createdAt,
      author: { '@type': 'Organization', name: 'AI Torah', url: 'https://aitorah.ai' },
      answerCount: 1,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answerMarkdown.slice(0, 500),
        url: pageUrl,
        upvoteCount: qa.viewCount ?? 0,
        dateCreated: qa.publishedAt ?? qa.createdAt,
        author: { '@type': 'Organization', name: 'AI Torah', url: 'https://aitorah.ai' },
        citation: qa.sourceRefs.map((ref) => ({
          '@type': 'CreativeWork',
          name: ref,
          url: `https://www.sefaria.org/${ref.replace(/ /g, '_')}`,
        })),
      },
    },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aitorah.ai' },
      { '@type': 'ListItem', position: 2, name: 'Torah Q&A', item: 'https://aitorah.ai/answers' },
      ...(primaryCategory && categorySlug
        ? [{ '@type': 'ListItem', position: 3, name: primaryCategory, item: `https://aitorah.ai/topics/${categorySlug}` }]
        : []),
      { '@type': 'ListItem', position: primaryCategory && categorySlug ? 4 : 3, name: qa.question },
    ],
  }

  return (
    <QaPageLayout categoryStats={categoryStats} activeCategory={primaryCategory}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <AnswerContent qa={qa} related={related} slug={slug} />
    </QaPageLayout>
  )
}

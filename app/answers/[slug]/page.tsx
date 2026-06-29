import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPublishedQaBySlug, getRelatedQaPairs } from '@/lib/db/qa'
import { AnswerContent } from '@/components/answers/AnswerContent'

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const qa = await getPublishedQaBySlug(slug)
  if (!qa || 'redirect' in qa) return {}

  const title = qa.metaTitle ?? `${qa.question} — AI Torah`
  const description = qa.metaDescription ?? qa.answerMarkdown.slice(0, 155).replace(/\n/g, ' ').trim()
  const url = `https://aitorah.ai/answers/${slug}`

  return {
    title,
    description,
    alternates: { canonical: `/answers/${slug}` },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      ...(qa.featuredImageUrl ? { images: [{ url: qa.featuredImageUrl }] } : {}),
    },
  }
}

export default async function AnswerPage({ params }: Props) {
  const { slug } = await params

  if (!process.env.DATABASE_URL) notFound()

  const qa = await getPublishedQaBySlug(slug)
  if (!qa) notFound()
  if ('redirect' in qa) redirect(`/answers/${qa.redirect}`)

  const related = await getRelatedQaPairs(qa.id, qa.categories)

  const pageUrl = `https://aitorah.ai/answers/${slug}`

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AnswerContent qa={qa} related={related} />
    </>
  )
}

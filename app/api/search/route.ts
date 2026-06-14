import { NextRequest } from 'next/server'
import { searchTexts, searchExact, hitToText } from '@/lib/sefaria/client'
import type { SefariaSearchHit } from '@/lib/sefaria/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const source = searchParams.get('source')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)

  if (!q) return Response.json({ error: 'Query required' }, { status: 400 })

  const categoryMap: Record<string, string> = {
    tanakh: 'Tanakh',
    mishnah: 'Mishnah',
    gemara: 'Talmud',
    rishonim: 'Rishonim on Talmud',
    acharonim: 'Acharonim on Talmud',
  }
  const categoryPath = source ? categoryMap[source.toLowerCase()] : undefined

  try {
    const [lemmatized, exact] = await Promise.allSettled([
      searchTexts(q, { size: limit, slop: 2, categoryPath }),
      searchExact(q, Math.min(limit, 5)),
    ])

    const seen = new Set<string>()
    const collected: { hit: SefariaSearchHit; boost: number }[] = []

    const collectHits = (hits: SefariaSearchHit[], boost: number) => {
      for (const hit of hits) {
        if (seen.has(hit._source.ref)) continue
        seen.add(hit._source.ref)
        collected.push({ hit, boost })
      }
    }

    if (lemmatized.status === 'fulfilled') collectHits(lemmatized.value.hits.hits, 0)
    if (exact.status === 'fulfilled') collectHits(exact.value.hits.hits, 0.1)

    const maxScore = Math.max(...collected.map((c) => c.hit._score), 1)

    const results = collected.map(({ hit, boost }) => {
      const { en, he } = hitToText(hit)
      const highlight = hit.highlight?.exact?.[0] || hit.highlight?.naive_lemmatizer?.[0]
      const normalized = Math.min(99, Math.max(1, Math.round(((hit._score / maxScore) * 90) + (boost * 100))))

      return {
        ref: hit._source.ref,
        type: hit._source.categories.join(' · '),
        source: hit._source.categories[0] ?? 'Unknown',
        similarity: normalized,
        hebrew: highlight?.replace(/<\/?b>/g, '') || he.slice(0, 300),
        english: en.slice(0, 300),
        sefaria_url: `https://www.sefaria.org/${hit._source.ref.replace(/ /g, '_')}`,
      }
    })

    results.sort((a, b) => b.similarity - a.similarity)

    return Response.json({
      results: results.slice(0, limit),
      total: results.length,
      query: q,
    })
  } catch (error) {
    console.error('Search error:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}

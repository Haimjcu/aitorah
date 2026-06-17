import Anthropic from '@anthropic-ai/sdk'
import type { RetrievedSource } from '../sefaria/types'
import type { ParsedIntent } from './intent'
import { classifyIntent } from './intent'
import {
  getTexts,
  searchTexts,
  searchExact,
  getLinks,
  getRelated,
  getTopic,
  autocomplete,
  extractTextPair,
  hitToText,
} from '../sefaria/client'

const MAX_SOURCES = 8

export interface RetrievalResult {
  intent: ParsedIntent
  sources: RetrievedSource[]
}

export async function retrieve(
  question: string,
  client: Anthropic,
  preClassifiedIntent?: ParsedIntent
): Promise<RetrievalResult> {
  const intent = preClassifiedIntent ?? await classifyIntent(question, client)

  const tasks: Promise<RetrievedSource[]>[] = []

  if (intent.refs.length > 0) {
    tasks.push(retrieveByRefs(intent.refs))
  }

  if (intent.topics.length > 0) {
    tasks.push(retrieveByTopics(intent.topics))
  }

  for (const term of intent.search_terms_en.slice(0, 2)) {
    tasks.push(retrieveBySearch(term, intent.category_hint))
  }

  for (const term of intent.search_terms_he.slice(0, 1)) {
    tasks.push(retrieveBySearch(term, intent.category_hint))
  }

  if (intent.type === 'commentary_request' && intent.refs.length > 0) {
    tasks.push(retrieveCommentary(intent.refs[0]))
  }

  if (intent.type === 'text_lookup' && intent.refs.length === 0 && intent.search_terms_en.length > 0) {
    tasks.push(retrieveByAutocomplete(intent.search_terms_en[0]))
  }

  const results = await Promise.allSettled(tasks)
  const allSources: RetrievedSource[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') allSources.push(...r.value)
  }

  const deduped = deduplicateSources(allSources)
  const ranked = deduped.sort((a, b) => b.score - a.score).slice(0, MAX_SOURCES)

  return { intent, sources: ranked }
}

async function retrieveByRefs(refs: string[]): Promise<RetrievedSource[]> {
  const sources: RetrievedSource[] = []

  for (const ref of refs.slice(0, 3)) {
    try {
      const data = await getTexts(ref, { version: 'primary' })
      const { en, he } = extractTextPair(data)
      if (!en && !he) continue
      sources.push({
        ref: data.ref,
        heRef: data.heRef,
        text_en: en,
        text_he: he,
        category: data.categories[0] ?? '',
        categories: data.categories,
        score: 1.0,
        source_type: 'direct',
      })
    } catch {
      // ref might be invalid — skip
    }
  }

  return sources
}

async function retrieveBySearch(
  query: string,
  categoryPath: string | null
): Promise<RetrievedSource[]> {
  const sources: RetrievedSource[] = []

  try {
    const [lemmatized, exact] = await Promise.allSettled([
      searchTexts(query, { size: 5, slop: 2, categoryPath: categoryPath ?? undefined }),
      searchExact(query, 3),
    ])

    const hits: { hit: import('../sefaria/types').SefariaSearchHit; boost: number }[] = []

    if (lemmatized.status === 'fulfilled') {
      for (const hit of lemmatized.value.hits.hits) {
        hits.push({ hit, boost: 0 })
      }
    }
    if (exact.status === 'fulfilled') {
      for (const hit of exact.value.hits.hits) {
        hits.push({ hit, boost: 0.1 })
      }
    }

    for (const { hit, boost } of hits) {
      const { en, he } = hitToText(hit)
      const psr = hit._source.pagesheetrank ?? 0.04
      const score = (hit._score / 100) * Math.log(psr + 1) + boost

      sources.push({
        ref: hit._source.ref,
        heRef: hit._source.heRef,
        text_en: en,
        text_he: he,
        category: hit._source.categories[0] ?? '',
        categories: hit._source.categories,
        score,
        source_type: 'search',
      })
    }
  } catch {
    // search failed — return empty
  }

  return sources
}

async function retrieveByTopics(topicSlugs: string[]): Promise<RetrievedSource[]> {
  const sources: RetrievedSource[] = []

  for (const slug of topicSlugs.slice(0, 2)) {
    try {
      const topic = await getTopic(slug, { withRefs: true })
      if (!topic.refs) continue

      const topRefs = topic.refs
        .sort((a, b) => (b.order?.pr ?? 0) - (a.order?.pr ?? 0))
        .slice(0, 3)

      for (const tr of topRefs) {
        try {
          const data = await getTexts(tr.ref, { version: 'primary' })
          const { en, he } = extractTextPair(data)
          if (!en && !he) continue
          sources.push({
            ref: data.ref,
            heRef: data.heRef,
            text_en: en,
            text_he: he,
            category: data.categories[0] ?? '',
            categories: data.categories,
            score: 0.7 + (tr.order?.pr ?? 0) * 0.01,
            source_type: 'topic',
            topic_slug: slug,
          })
        } catch {
          // skip invalid ref
        }
      }
    } catch {
      // topic not found — try autocomplete
      try {
        const matches = await autocomplete(slug, 3)
        for (const obj of matches.completion_objects) {
          if (obj.type === 'Topic') {
            return retrieveByTopics([obj.key])
          }
        }
      } catch {
        // autocomplete failed
      }
    }
  }

  return sources
}

async function retrieveCommentary(ref: string): Promise<RetrievedSource[]> {
  const sources: RetrievedSource[] = []

  try {
    const links = await getLinks(ref)
    const commentaries = links
      .filter((l) => l.category === 'Commentary' || l.type === 'commentary')
      .slice(0, 4)

    for (const link of commentaries) {
      const en = typeof link.text === 'string' ? link.text : Array.isArray(link.text) ? link.text.join(' ') : ''
      const he = typeof link.he === 'string' ? link.he : Array.isArray(link.he) ? link.he.join(' ') : ''
      if (!en && !he) continue

      sources.push({
        ref: link.ref,
        heRef: link.heRef,
        text_en: en,
        text_he: he,
        category: link.collectiveTitle?.en ?? 'Commentary',
        categories: ['Commentary'],
        score: 0.8,
        source_type: 'link',
        link_type: link.category,
      })
    }
  } catch {
    // links failed
  }

  return sources
}

async function retrieveByAutocomplete(term: string): Promise<RetrievedSource[]> {
  const sources: RetrievedSource[] = []

  try {
    const matches = await autocomplete(term, 3)
    for (const obj of matches.completion_objects.slice(0, 2)) {
      if (obj.type === 'ref' || obj.type === 'TocCategory') {
        try {
          const data = await getTexts(obj.key, { version: 'primary' })
          const { en, he } = extractTextPair(data)
          if (!en && !he) continue
          sources.push({
            ref: data.ref,
            heRef: data.heRef,
            text_en: en,
            text_he: he,
            category: data.categories[0] ?? '',
            categories: data.categories,
            score: 0.6,
            source_type: 'direct',
          })
        } catch {
          // skip
        }
      }
    }
  } catch {
    // autocomplete failed
  }

  return sources
}

function deduplicateSources(sources: RetrievedSource[]): RetrievedSource[] {
  const seen = new Map<string, RetrievedSource>()
  for (const src of sources) {
    const existing = seen.get(src.ref)
    if (!existing || src.score > existing.score) {
      seen.set(src.ref, src)
    }
  }
  return Array.from(seen.values())
}

export function formatSourcesForPrompt(sources: RetrievedSource[]): string {
  if (sources.length === 0) return 'No specific sources were retrieved for this question.'

  return sources
    .map((s, i) => {
      const parts = [`[Source ${i + 1}: ${s.ref} (${s.category})]`]
      if (s.text_he) parts.push(`Hebrew: ${s.text_he.slice(0, 500)}`)
      if (s.text_en) parts.push(`English: ${s.text_en.slice(0, 500)}`)
      return parts.join('\n')
    })
    .join('\n\n')
}

export function sourcesToClientFormat(
  sources: RetrievedSource[]
): { ref: string; type: string; similarity: number; hebrew: string; english: string }[] {
  const maxScore = Math.max(...sources.map((s) => s.score), 1)
  return sources.map((s) => ({
    ref: s.ref,
    type: s.categories.join(' · '),
    similarity: Math.min(99, Math.max(1, Math.round((s.score / maxScore) * 95))),
    hebrew: s.text_he.slice(0, 300),
    english: s.text_en.slice(0, 300),
  }))
}

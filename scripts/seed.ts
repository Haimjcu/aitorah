import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { qaPairs } from '@/lib/db/schema'
import { normalizeQuestion, generateSlug } from '@/lib/db/qa'
import { classifyIntent } from '@/lib/rag/intent'
import { retrieve, formatSourcesForPrompt } from '@/lib/rag/retrieval'
import { buildStudyPartnerSystemPrompt } from '@/lib/ai/prompts'
import { generateFeaturedImage } from '@/lib/image-gen'
import seedData from './seed-questions.json'

interface SeedEntry {
  question: string
  primary_keyword: string
  monthly_searches: number
  alt_keywords: string[]
  variant_count: number
}

const DELAY_BETWEEN_QUESTIONS_MS = 3000
const DELAY_AFTER_IMAGE_MS = 2000

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function seedQuestion(
  entry: SeedEntry,
  anthropic: Anthropic,
  index: number,
  total: number,
): Promise<boolean> {
  const { question } = entry
  const normalized = normalizeQuestion(question)
  const db = getDb()

  const [existing] = await db
    .select({ id: qaPairs.id })
    .from(qaPairs)
    .where(eq(qaPairs.questionNormalized, normalized))
    .limit(1)

  if (existing) {
    console.log(`[${index + 1}/${total}] SKIP (exists): ${question}`)
    return false
  }

  console.log(`[${index + 1}/${total}] Processing: ${question}`)

  // 1. Classify intent
  const intent = await classifyIntent(question, anthropic)
  console.log(`  Intent: ${intent.type}`)

  // 2. Retrieve sources from Sefaria
  const { sources } = await retrieve(question, anthropic, intent)
  console.log(`  Sources: ${sources.length}`)

  // 3. Generate answer via Claude Sonnet
  const passagesText = formatSourcesForPrompt(sources)
  const systemPrompt = buildStudyPartnerSystemPrompt(passagesText)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  })

  const answerMarkdown = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  if (!answerMarkdown || answerMarkdown.length < 50) {
    console.log(`  WARN: Answer too short (${answerMarkdown.length} chars), skipping`)
    return false
  }

  // 4. Extract metadata from sources
  const sourceRefs = sources.map(s => s.ref)
  const categories = [...new Set(sources.flatMap(s => s.categories ?? []))]
  const topics = [...new Set(sources.map(s => s.topic_slug).filter(Boolean))] as string[]
  const slug = generateSlug(question)

  // 5. Generate meta fields
  const metaTitle = `${question} — AI Torah`
  const plainText = stripMarkdown(answerMarkdown)
  const metaDescription = plainText.slice(0, 155).trim() + '...'

  // 6. Generate featured image
  let featuredImageUrl: string | null = null
  try {
    featuredImageUrl = await generateFeaturedImage(
      question,
      categories.length > 0 ? categories : null,
      slug,
    )
    console.log(`  Image: ${featuredImageUrl ? 'generated' : 'failed'}`)
    if (featuredImageUrl) await sleep(DELAY_AFTER_IMAGE_MS)
  } catch (err) {
    console.log(`  Image error: ${err instanceof Error ? err.message : err}`)
  }

  // 7. Insert as approved
  await db.insert(qaPairs).values({
    question,
    questionNormalized: normalized,
    answerMarkdown,
    sourceRefs,
    topics: topics.length > 0 ? topics : null,
    categories: categories.length > 0 ? categories : null,
    slug,
    status: 'approved',
    publishedAt: new Date('2023-06-01T00:00:00Z'),
    createdAt: new Date('2023-06-01T00:00:00Z'),
    metaTitle,
    metaDescription,
    featuredImageUrl,
    viewCount: 1,
  }).onConflictDoNothing()

  console.log(`  DONE: ${slug} (${answerMarkdown.length} chars, ${sourceRefs.length} refs)`)
  return true
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required')
    process.exit(1)
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const entries = seedData as SeedEntry[]

  // Parse optional --start and --limit flags
  const startArg = process.argv.find(a => a.startsWith('--start='))
  const limitArg = process.argv.find(a => a.startsWith('--limit='))
  const start = startArg ? parseInt(startArg.split('=')[1]) : 0
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : entries.length

  const subset = entries.slice(start, start + limit)
  console.log(`\nSeeding ${subset.length} questions (${start} to ${start + subset.length - 1} of ${entries.length} total)\n`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < subset.length; i++) {
    try {
      const wasCreated = await seedQuestion(subset[i], anthropic, start + i, entries.length)
      if (wasCreated) created++
      else skipped++
    } catch (err) {
      failed++
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`)
    }

    if (i < subset.length - 1) {
      await sleep(DELAY_BETWEEN_QUESTIONS_MS)
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Created: ${created}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed:  ${failed}`)
  console.log(`Total:   ${subset.length}`)
  process.exit(0)
}

main()

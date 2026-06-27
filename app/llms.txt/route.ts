import { getPublishedQaPairs } from '@/lib/db/qa'
import { CATEGORIES } from '@/lib/categories'

export const revalidate = 3600

export async function GET() {
  const { items } = await getPublishedQaPairs({ limit: 500 })

  const qaLines = items.map(
    (item) => `- /answers/${item.slug}: ${item.question}`
  )

  const topicLines = CATEGORIES.map(
    (cat) => `- /topics/${cat.slug}: ${cat.name} — ${cat.description}`
  )

  const body = `# AI Torah

> A living community of scholars and developers building AI tools rooted in authentic Jewish tradition.

AI Torah is a platform at the intersection of artificial intelligence and Torah scholarship. It provides AI-powered study tools, semantic search across thousands of Torah texts, and a community for scholars and developers to collaborate.

## Core Features

- **AI Study Partner**: Conversational Torah study powered by Claude. Ask questions about Tanakh, Talmud, Halacha, and Jewish philosophy. Responses include cited sources in Hebrew and English.
- **Semantic Torah Search**: Search by meaning across Tanakh, Mishnah, Gemara, Rishonim, and Acharonim. Built on Sefaria's ElasticSearch with Hebrew morphological analysis.
- **Jewish Calendar**: Real-time calendar data via Hebcal — weekly parasha, daily learning schedules, Shabbat times, halachic zmanim, holidays, and date conversion.
- **Q&A Library**: Curated Torah Q&A pairs with cited sources, organized by topic and category.
- **Community**: Discord server for Torah scholars and AI developers.

## Pages

- /: Home page with overview, features, and how it works
- /study: AI Study Partner — conversational Torah study with cited sources
- /search: Torah Search — full-text search across the Sefaria library
- /answers: Browse all published Torah Q&A pairs by category
- /topics: Browse Q&A by Torah topic categories
- /community: Community hub — Discord server and channels
- /contact: Get involved, learn about the vision, and contact the founder

## Topic Pages

${topicLines.join('\n')}

## Published Q&A (${items.length} answers)

${qaLines.join('\n')}

## Tech Stack

- Next.js (App Router)
- Sefaria API for Torah text retrieval and search
- Hebcal API for Jewish calendar data
- Anthropic Claude API for AI study partner
- Hosted on Railway

## Contact

- Email: haim@aitorah.ai
- Founded by Rabbi Haim Lubin
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

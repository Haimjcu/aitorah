import { NextRequest } from 'next/server'

const MOCK_RESULTS = [
  { ref: 'Bava Metzia 49a', type: 'Gemara · Talmud Bavli', source: 'gemara', similarity: 0.96, hebrew: 'כָּל הַחוֹזֵר בּוֹ, אֵין רוּחַ חֲכָמִים נוֹחָה הֵימֶנּוּ', english: '"Whoever retracts from a verbal commitment in business, the spirit of the Sages is not pleased with him."' },
  { ref: 'Shabbat 55a', type: 'Gemara · Talmud Bavli', source: 'gemara', similarity: 0.91, hebrew: 'חוֹתָמוֹ שֶׁל הַקָּדוֹשׁ בָּרוּךְ הוּא אֱמֶת', english: '"The seal of the Holy One, Blessed be He, is truth."' },
  { ref: 'Mishlei 23:23', type: 'Tanakh · Ketuvim', source: 'tanakh', similarity: 0.88, hebrew: 'אֱמֶת קְנֵה וְאַל-תִּמְכֹּר חָכְמָה וּמוּסָר וּבִינָה', english: '"Buy truth and do not sell it — also wisdom, discipline and understanding."' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const source = searchParams.get('source')
  const limit = parseInt(searchParams.get('limit') ?? '10')

  if (!q) return Response.json({ error: 'Query required' }, { status: 400 })

  // TODO: replace with real pgvector search once DATABASE_URL is set
  const results = MOCK_RESULTS
    .filter((r) => !source || r.source === source.toLowerCase())
    .slice(0, limit)
    .map((r) => ({ ...r, similarity: Math.round(r.similarity * 100) }))

  return Response.json({ results, total: results.length, query: q })
}

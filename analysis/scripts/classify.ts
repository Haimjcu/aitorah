// Classify every user question (qa_pairs + study_sessions user turns) by Torah domain, shape, and language.
// Uses Claude Haiku 5.5 via the Message Batches API (50% cost) with structured outputs.
//   submit:  npx tsx analysis/scripts/classify.ts submit
//   collect: npx tsx analysis/scripts/classify.ts collect <batch_id>   (polls until done)
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import crypto from 'crypto'

const DATA = 'analysis/data'
const MODEL = 'claude-haiku-5-5'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const DOMAINS = [
  'halacha', 'chassidut', 'gemara_talmud', 'mishnah', 'tanakh_parsha', 'mefarshim_commentary', 'midrash_aggadah',
  'kabbalah_zohar', 'machshava_philosophy', 'mussar_middot', 'tefillah_liturgy', 'minhag_customs', 'calendar_zmanim',
  'jewish_history', 'hebrew_aramaic_language', 'life_guidance', 'conversion_non_jewish_seeker', 'interfaith_comparative',
  'translation_request', 'meta_app_chitchat', 'off_topic', 'other',
] as const
const SHAPES = [
  'practical_ruling', 'source_request', 'explanation', 'comparison_of_views', 'text_lookup', 'translate_or_explain_pasted_text',
  'word_meaning', 'personal_advice', 'followup_clarification', 'challenge_or_correction', 'chitchat', 'other',
] as const
const LANGS = ['english', 'hebrew', 'yiddish', 'russian', 'french', 'spanish', 'portuguese', 'german', 'mixed', 'other'] as const

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['domain', 'secondary_domains', 'sub_topic', 'shape', 'language', 'language_other', 'transliterated_hebrew',
    'contains_pasted_text', 'dissatisfaction', 'needs_practical_ruling', 'community_dependent'],
  properties: {
    domain: { type: 'string', enum: DOMAINS },
    secondary_domains: { type: 'array', items: { type: 'string', enum: DOMAINS } },
    sub_topic: { type: 'string', description: '2-5 word lowercase label, e.g. "shabbat cooking", "tanya chapter explanation"' },
    shape: { type: 'string', enum: SHAPES },
    language: { type: 'string', enum: LANGS },
    language_other: { type: 'string', description: 'Name of the language if language is "other" or "mixed", else ""' },
    transliterated_hebrew: { type: 'boolean' },
    contains_pasted_text: { type: 'boolean', description: 'User pasted an article, page, or long passage' },
    dissatisfaction: { type: 'boolean', description: 'User says the previous answer was wrong, missing, or unhelpful' },
    needs_practical_ruling: { type: 'boolean', description: 'Asks what to actually do in practice (halacha l\'maaseh)' },
    community_dependent: { type: 'boolean', description: 'Correct answer differs by community (Ashkenazi/Sephardi/Chabad/etc.)' },
  },
}

const SYSTEM = `You label user messages sent to a Torah study chatbot, for analytics. Classify the USER MESSAGE only; context is given just to interpret short follow-ups.

Domains:
- halacha: Jewish law, what is permitted/forbidden, how to perform a mitzvah
- chassidut: Chassidic teachings (Tanya, Baal Shem Tov, Rebbes, Breslov, Chabad thought)
- gemara_talmud: Talmud Bavli/Yerushalmi passages, sugyot, daf
- mishnah: Mishnah, Pirkei Avot
- tanakh_parsha: Torah, Prophets, Writings, weekly parasha content, biblical narrative and figures
- mefarshim_commentary: what a specific commentator (Rashi, Ramban, Ibn Ezra, Or HaChaim...) says
- midrash_aggadah: Midrash, aggadic stories
- kabbalah_zohar: Kabbalah, Zohar, sefirot, Arizal
- machshava_philosophy: Jewish thought/belief: Rambam's philosophy, Kuzari, free will, afterlife, God, providence
- mussar_middot: character traits, ethics, self-improvement
- tefillah_liturgy: prayer, siddur, brachot text, piyyutim
- minhag_customs: customs and traditions (not binding law), lifecycle customs
- calendar_zmanim: dates, parasha of the week, holidays timing, zmanim, daf yomi schedule
- jewish_history: historical events and people
- hebrew_aramaic_language: meaning/grammar of Hebrew or Aramaic words, gematria
- life_guidance: personal life questions seeking Torah perspective (relationships, grief, work)
- conversion_non_jewish_seeker: non-Jews, Noahides, conversion, people seeking to come closer
- interfaith_comparative: comparison with Christianity/Islam/other religions
- translation_request: mainly asking to translate text
- meta_app_chitchat: greetings, thanks, questions about the bot itself
- off_topic: unrelated to Judaism
- other: none fit
Pick the single best domain; put other relevant domains in secondary_domains (may be empty).
Language = the language the user wrote in (not the language of quoted sources). Yiddish uses Hebrew letters but Germanic words (איז, נישט, וואס, פון, דאס). Use "mixed" when two languages are substantially mixed.`

type Item = { id: string; text: string; context: string }

// Code-point-safe truncation; also drops lone surrogates that make the request body invalid JSON.
const cut = (s: string, n: number) =>
  Array.from(s).slice(0, n).join('').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')

function loadItems(): Item[] {
  const read = (f: string) => fs.readFileSync(`${DATA}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const items: Item[] = []
  for (const q of read('qa_pairs.jsonl')) items.push({ id: `qa_${q.id}`, text: String(q.question), context: '' })
  for (const s of read('study_sessions.jsonl')) {
    const msgs: { role: string; content: string }[] = Array.isArray(s.messages) ? s.messages : []
    let firstUser = ''
    msgs.forEach((m, i) => {
      if (m.role !== 'user') return
      const text = String(m.content ?? '')
      let context = ''
      if (firstUser) {
        const prevAssistant = [...msgs.slice(0, i)].reverse().find((x) => x.role === 'assistant')
        context = `Conversation started with: ${cut(firstUser, 300)}\nPrevious assistant reply (start): ${cut(String(prevAssistant?.content ?? ''), 300)}`
      } else firstUser = text
      items.push({ id: `ss_${s.id}_${i}`, text, context })
    })
  }
  return items
}

const key = (it: Item) => crypto.createHash('sha1').update(it.text.trim().toLowerCase() + '|' + it.context).digest('hex').slice(0, 32)

async function submit() {
  const items = loadItems()
  const unique = new Map<string, Item>()
  for (const it of items) if (it.text.trim()) unique.set(key(it), it)
  fs.writeFileSync(`${DATA}/classify-items.json`, JSON.stringify(items.map((it) => ({ id: it.id, key: key(it) }))))
  console.log(`items ${items.length}, unique ${unique.size}`)
  const requests = [...unique.entries()].map(([k, it]) => ({
    custom_id: k,
    params: {
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low' as const, format: { type: 'json_schema' as const, schema } },
      system: SYSTEM,
      messages: [{ role: 'user' as const, content: (it.context ? `CONTEXT:\n${it.context}\n\n` : '') + `USER MESSAGE:\n${cut(it.text, 2500)}` }],
    },
  }))
  const batch = await client.messages.batches.create({ requests } as Anthropic.Messages.BatchCreateParams)
  fs.writeFileSync(`${DATA}/classify-batch.json`, JSON.stringify({ id: batch.id, created: new Date().toISOString(), requests: requests.length }))
  console.log('batch', batch.id, batch.processing_status)
}

async function collect(id: string) {
  for (;;) {
    const b = await client.messages.batches.retrieve(id)
    console.log(new Date().toISOString(), b.processing_status, JSON.stringify(b.request_counts))
    if (b.processing_status === 'ended') break
    await new Promise((r) => setTimeout(r, 60_000))
  }
  const labels: Record<string, unknown> = {}
  let inTok = 0, outTok = 0, failed = 0
  for await (const r of await client.messages.batches.results(id)) {
    if (r.result.type !== 'succeeded') { failed++; continue }
    const m = r.result.message
    inTok += m.usage.input_tokens; outTok += m.usage.output_tokens
    const text = m.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('')
    try { labels[r.custom_id] = JSON.parse(text) } catch { failed++ }
  }
  const items: { id: string; key: string }[] = JSON.parse(fs.readFileSync(`${DATA}/classify-items.json`, 'utf8'))
  fs.writeFileSync(`${DATA}/labels.jsonl`, items.filter((i) => labels[i.key]).map((i) => JSON.stringify({ id: i.id, ...(labels[i.key] as object) })).join('\n'))
  const cost = (inTok * 0.10 + outTok * 0.50) / 1e6 / 2
  console.log(`labeled ${Object.keys(labels).length}, failed ${failed}, tokens in ${inTok} out ${outTok}, est cost $${cost.toFixed(2)}`)
}

const [cmd, arg] = process.argv.slice(2)
;(cmd === 'submit' ? submit() : collect(arg)).catch((e) => { console.error('ERR', e.status ?? '', e.message); process.exit(1) })

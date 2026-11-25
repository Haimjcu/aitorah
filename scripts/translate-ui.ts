// Generate lib/i18n/messages/<locale>.json from en.ts with Claude Sonnet 5.5.
// Machine translations: have a native speaker review each file (see "_meta.review" in the JSON).
//   scripts/dev-local.sh npx tsx scripts/translate-ui.ts [he fr ...] [--all]
// By default only keys missing from a locale file are translated, so reviewed translations are kept.
// --all retranslates everything.
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import { en } from '@/lib/i18n/messages/en'
import { ANSWER_MODEL } from '@/lib/ai/models'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const NAMES: Record<string, string> = {
  he: 'Modern Hebrew', fr: 'French', es: 'Spanish', ru: 'Russian', pt: 'Brazilian Portuguese', de: 'German',
  yi: 'Yiddish (standard orthography as used in Haredi publications, with Hebrew-origin words spelled as in Hebrew)',
}

function schemaFor(obj: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) props[k] = typeof v === 'string' ? { type: 'string' } : schemaFor(v as Record<string, unknown>)
  return { type: 'object', additionalProperties: false, required: Object.keys(obj), properties: props }
}

async function translateSection(locale: string, section: Record<string, unknown>) {
  const res = await client.messages.stream({
    model: ANSWER_MODEL.model,
    max_tokens: 32000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: schemaFor(section) } },
    system: `You translate the user interface of "AI Torah", a Torah study web app, from English into ${NAMES[locale]}.
- Natural, concise UI language for an observant Jewish audience. Keep Jewish terms in their customary form for that language community (e.g. Halacha, Talmud, Shabbat, chavruta, Daf Yomi, nusach; in Hebrew/Yiddish use the Hebrew terms).
- Keep placeholders like {count}, {name}, {date}, {content} exactly as is.
- Keep proper names (Sefaria, Steinsaltz, Chabad, Berakhot) recognizable.
- Same JSON keys; translate only the values.`,
    messages: [{ role: 'user', content: JSON.stringify(section, null, 1) }],
  }).finalMessage()
  return JSON.parse(res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(''))
}

// One request per section keeps each structured-output schema small.
async function translate(locale: string, all: boolean) {
  const file = `lib/i18n/messages/${locale}.json`
  const existing: Record<string, Record<string, string>> = !all && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  const out: Record<string, unknown> = { _meta: { review: 'machine-translated by Claude; needs native-speaker review', generated: new Date().toISOString().slice(0, 10) } }
  let added = 0
  for (const [name, section] of Object.entries(en) as [string, Record<string, string>][]) {
    const have = existing[name] ?? {}
    const missing = Object.fromEntries(Object.entries(section).filter(([k]) => !(k in have)))
    const fresh = Object.keys(missing).length ? await translateSection(locale, missing) : {}
    added += Object.keys(fresh).length
    // Keep en.ts key order; drop keys no longer in en.ts.
    out[name] = Object.fromEntries(Object.keys(section).map((k) => [k, k in have ? have[k] : fresh[k]]))
  }
  if (!all && existing._meta) out._meta = { ...existing._meta, updated: new Date().toISOString().slice(0, 10), lastAddedKeys: added }
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  console.log(`${locale}: ${added} strings translated`)
}

const args = process.argv.slice(2)
const all = args.includes('--all')
const picked = args.filter((a) => !a.startsWith('--'))
const targets = picked.length ? picked : Object.keys(NAMES)
Promise.all(targets.map((l) => translate(l, all))).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

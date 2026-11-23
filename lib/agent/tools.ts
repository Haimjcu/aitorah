// Agent tools: typed wrappers over the existing Sefaria and Hebcal clients.
// Data sources are unchanged (Sefaria + Hebcal); the agent decides what to look up.
import type Anthropic from '@anthropic-ai/sdk'
import {
  getTexts, searchTexts, getLinks, getTopic, autocomplete, flattenText, hitToText,
} from '@/lib/sefaria/client'
import { resolveCalendar } from '@/lib/hebcal/resolver'
import type { ParsedIntent, IntentType } from '@/lib/rag/intent'
import type { GeoInfo } from '@/lib/hebcal/types'

export interface ToolContext {
  /** ISO code of the user's language (en, he, fr, es, ru, yi, pt, de). */
  language: string
  geo: GeoInfo | null
  /** Every ref the agent actually retrieved — used for the sources list and the citation check. */
  retrievedRefs: Map<string, { heRef?: string; category?: string }>
}

const LANG_NAME: Record<string, string> = {
  fr: 'french', es: 'spanish', ru: 'russian', pt: 'portuguese', de: 'german', yi: 'yiddish',
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + ' …[truncated]' : s)
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

type Runner = (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>

interface AgentTool {
  definition: Anthropic.Tool
  run: Runner
}

const CATEGORIES = ['Tanakh', 'Mishnah', 'Talmud', 'Midrash', 'Halakhah', 'Kabbalah', 'Liturgy', 'Jewish Thought', 'Chasidut', 'Musar', 'Commentary', 'Responsa', 'Tosefta']

const get_text: AgentTool = {
  definition: {
    name: 'get_text',
    description: 'Fetch the text of a specific source by Sefaria reference (e.g. "Genesis 1:1-3", "Berakhot 2a", "Shulchan Arukh, Orach Chayim 263:1", "Rashi on Genesis 1:1", "Mishneh Torah, Shabbat 5:1"). Returns Hebrew/Aramaic, English, and the user\'s language when Sefaria has a translation. Keep ranges short (a few verses or one se\'if/daf section).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ref'],
      properties: { ref: { type: 'string', description: 'Sefaria-format reference' } },
    },
    strict: true,
  },
  async run(input, ctx) {
    const ref = String(input.ref)
    const langs = ['hebrew', 'english', LANG_NAME[ctx.language]].filter(Boolean)
    const res = await getTexts(ref, { version: langs })
    const err = (res as unknown as { error?: string }).error
    if (err) return { error: `Sefaria: ${err}. Use find_ref to check the book name, or search_texts.` }
    const out: Record<string, string> = {}
    for (const v of res.versions ?? []) {
      const t = flattenText(v.text)
      if (!t) continue
      const key = v.language === 'he' ? 'hebrew' : v.language === 'en' ? 'english' : `translation_${v.language}`
      if (!out[key]) out[key] = clip(stripHtml(t), 3500)
    }
    ctx.retrievedRefs.set(res.ref, { heRef: res.heRef })
    const userLang = LANG_NAME[ctx.language]
    return {
      ref: res.ref,
      heRef: res.heRef,
      ...out,
      ...(userLang ? { user_language_translation_available: Object.keys(out).some((k) => k.startsWith('translation_')) } : {}),
    }
  },
}

const search_texts: AgentTool = {
  definition: {
    name: 'search_texts',
    description: 'Full-text search across the Sefaria library (Hebrew or English query). Use to find where a concept, phrase, or law appears. Optionally restrict to a top-level category. Returns refs with short snippets; use get_text to read a hit in full.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['query', 'category', 'exact'],
      properties: {
        query: { type: 'string', description: 'Search phrase, 1-6 words. Hebrew queries find Hebrew text; English queries find translations.' },
        category: { anyOf: [{ type: 'string', enum: CATEGORIES }, { type: 'null' }], description: 'Restrict to this category, or null for all' },
        exact: { type: 'boolean', description: 'true = exact phrase match; false = lemmatized (recommended)' },
      },
    },
    strict: true,
  },
  async run(input, ctx) {
    const res = await searchTexts(String(input.query), {
      size: 8,
      field: input.exact ? 'exact' : 'naive_lemmatizer',
      slop: input.exact ? 0 : 2,
      categoryPath: (input.category as string | null) ?? undefined,
    })
    const hits = (res.hits?.hits ?? []).map((h) => {
      const t = hitToText(h)
      ctx.retrievedRefs.set(h._source.ref, { heRef: h._source.heRef, category: h._source.categories?.[0] })
      return {
        ref: h._source.ref,
        category: h._source.categories?.join(' > '),
        snippet: clip(stripHtml(t.en || t.he), 350),
      }
    })
    return hits.length ? { hits } : { hits: [], note: 'No results. Try a shorter query, Hebrew terms, or no category.' }
  },
}

const get_links: AgentTool = {
  definition: {
    name: 'get_links',
    description: 'List sources linked to a reference: commentaries (Rashi, Ramban, Tosafot…), halachic codes citing it, midrash, Talmud parallels. Use after get_text to find what commentators say on a verse, daf, or law. Filter by category to keep results focused.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ref', 'category'],
      properties: {
        ref: { type: 'string', description: 'Sefaria reference, e.g. "Exodus 20:8" or "Shabbat 21b"' },
        category: {
          anyOf: [{ type: 'string', enum: ['Commentary', 'Halakhah', 'Midrash', 'Talmud', 'Kabbalah', 'Chasidut', 'Jewish Thought', 'Quoting Commentary', 'Targum'] }, { type: 'null' }],
          description: 'Only links of this category, or null for all',
        },
      },
    },
    strict: true,
  },
  async run(input, ctx) {
    const links = await getLinks(String(input.ref), true)
    const cat = input.category as string | null
    const filtered = (Array.isArray(links) ? links : []).filter((l) => !cat || l.category === cat).slice(0, 20)
    return {
      links: filtered.map((l) => {
        ctx.retrievedRefs.set(l.ref, { heRef: l.heRef, category: l.category })
        const en = flattenText(l.text)
        const he = flattenText(l.he)
        return {
          ref: l.ref,
          category: l.category,
          commentator: l.collectiveTitle?.en,
          preview: clip(stripHtml(en || he), 300),
        }
      }),
      total_links: Array.isArray(links) ? links.length : 0,
    }
  },
}

const get_topic: AgentTool = {
  definition: {
    name: 'get_topic',
    description: 'Get a Sefaria topic page by slug (e.g. "shabbat", "teshuvah", "free-will", "tzedakah"): description and the most important source refs for that topic.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['slug'],
      properties: { slug: { type: 'string', description: 'Lowercase topic slug with hyphens' } },
    },
    strict: true,
  },
  async run(input, ctx) {
    try {
      const t = await getTopic(String(input.slug), { withRefs: true })
      const refs = ((t as unknown as { refs?: { about?: { ref: string; order?: { tfidf?: number } }[] } }).refs?.about ?? [])
        .sort((a, b) => (b.order?.tfidf ?? 0) - (a.order?.tfidf ?? 0))
        .slice(0, 12)
        .map((r) => r.ref)
      refs.forEach((r) => ctx.retrievedRefs.set(r, {}))
      const desc = (t as unknown as { description?: { en?: string } }).description?.en ?? ''
      return { slug: input.slug, title: (t as unknown as { primaryTitle?: { en?: string } }).primaryTitle?.en, description: clip(desc, 800), top_sources: refs }
    } catch {
      return { error: 'Topic not found. Try a different slug or use search_texts.' }
    }
  },
}

const find_ref: AgentTool = {
  definition: {
    name: 'find_ref',
    description: 'Resolve a book, commentator, or partial reference name to Sefaria\'s canonical spelling (e.g. "Kitzur Shulchan Aruch", "Likutei Moharan", "Mishna Brura"). Use when get_text returns an error about a name.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string' } },
    },
    strict: true,
  },
  async run(input) {
    const r = await autocomplete(String(input.name), 8)
    const m = r as unknown as { is_ref?: boolean; ref?: string; completions?: string[]; book?: string }
    return { is_ref: m.is_ref ?? false, canonical: m.ref ?? m.book ?? null, suggestions: (m.completions ?? []).slice(0, 8) }
  },
}

const CAL_KINDS: Record<string, IntentType> = {
  parasha: 'calendar_parasha',
  shabbat_times: 'calendar_shabbat',
  zmanim: 'calendar_zmanim',
  holidays: 'calendar_holiday',
  daily_learning: 'calendar_learning',
  date_convert: 'calendar_date',
}

const calendar: AgentTool = {
  definition: {
    name: 'calendar',
    description: 'Live Jewish calendar data from Hebcal for the user\'s location (Israel vs. Diaspora handled automatically): this week\'s parasha, Shabbat candle-lighting/havdalah, zmanim, upcoming holidays/fasts, daily learning schedules (Daf Yomi, Rambam, Tanya, Chumash…), and Hebrew/Gregorian date conversion. Never guess dates or times — use this tool.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'date', 'learning_type', 'hebrew_date'],
      properties: {
        kind: { type: 'string', enum: Object.keys(CAL_KINDS) },
        date: { type: ['string', 'null'], description: '"today", "tomorrow", "this_week", or YYYY-MM-DD; null = today' },
        learning_type: {
          anyOf: [
            { type: 'string', enum: ['daf_yomi', 'mishna_yomi', 'yerushalmi_yomi', 'tanakh_yomi', 'nach_yomi', 'rambam_1', 'rambam_3', 'sefer_hamitzvos', 'chofetz_chaim', 'tehillim', 'pirkei_avot', 'tanya', 'hayom_yom', 'chumash_rashi', 'all'] },
            { type: 'null' },
          ],
        },
        hebrew_date: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['hy', 'hm', 'hd'],
              properties: { hy: { type: 'integer' }, hm: { type: 'string' }, hd: { type: 'integer' } },
            },
            { type: 'null' },
          ],
          description: 'For converting a Hebrew date to Gregorian; null otherwise',
        },
      },
    },
    strict: true,
  },
  async run(input, ctx) {
    const date = (input.date as string | null) ?? 'today'
    const isIso = /^\d{4}-\d{2}-\d{2}$/.test(date)
    const intent: ParsedIntent = {
      type: CAL_KINDS[String(input.kind)],
      refs: [], topics: [], search_terms_en: [], search_terms_he: [], category_hint: null, language: ctx.language,
      calendar_params: {
        needs_location: true,
        date_reference: date,
        hebrew_date: (input.hebrew_date as ParsedIntent['calendar_params'] extends infer C ? C extends { hebrew_date: infer H } ? H : null : null) ?? null,
        gregorian_date: isIso ? date : null,
        learning_type: (input.learning_type as string | null) ?? null,
      },
    }
    const r = await resolveCalendar(intent, ctx.geo)
    if (r.parashaRef) ctx.retrievedRefs.set(r.parashaRef, {})
    return { data: r.text, parasha_ref: r.parashaRef ?? null }
  },
}

export const AGENT_TOOLS: AgentTool[] = [get_text, search_texts, get_links, get_topic, find_ref, calendar]

export const TOOL_DEFINITIONS: Anthropic.Tool[] = AGENT_TOOLS.map((t) => t.definition)

/** Run one tool call; errors become tool results (is_error) rather than exceptions. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<{ content: string; isError: boolean }> {
  const tool = AGENT_TOOLS.find((t) => t.definition.name === name)
  if (!tool) return { content: `Unknown tool ${name}`, isError: true }
  if (!input || typeof input !== 'object') return { content: 'Invalid tool input', isError: true }
  try {
    const out = await tool.run(input as Record<string, unknown>, ctx)
    return { content: JSON.stringify(out), isError: false }
  } catch (e) {
    return { content: `Tool failed: ${(e as Error).message.slice(0, 300)}`, isError: true }
  }
}

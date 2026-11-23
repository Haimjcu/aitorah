// Router: picks the specialist domain(s), shared skills, and language for a message (Haiku 5.5, structured output).
import type Anthropic from '@anthropic-ai/sdk'
import { INTENT_MODEL } from '@/lib/ai/models'

export const SPECIALIST_DOMAINS = [
  'tanakh_parasha', 'halacha_minhag', 'gemara_mishnah', 'kabbalah_chassidut', 'machshava_mussar_life',
] as const
export type SpecialistDomain = (typeof SPECIALIST_DOMAINS)[number]

export const SHARED_SKILLS = ['calendar', 'word_meaning', 'translation', 'tefillah', 'long_form'] as const
export type SharedSkill = (typeof SHARED_SKILLS)[number]

export const LANGUAGES = ['en', 'he', 'fr', 'es', 'ru', 'yi', 'pt', 'de', 'other'] as const

export interface Route {
  domains: SpecialistDomain[]        // 1-2, primary first
  shared_skills: SharedSkill[]
  language: (typeof LANGUAGES)[number]
  needs_practical_ruling: boolean
  community_dependent: boolean
  off_topic: boolean
  usage?: Anthropic.Usage
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['domains', 'shared_skills', 'language', 'needs_practical_ruling', 'community_dependent', 'off_topic'],
  properties: {
    domains: { type: 'array', items: { type: 'string', enum: SPECIALIST_DOMAINS }, description: '1-2 domains, primary first' },
    shared_skills: { type: 'array', items: { type: 'string', enum: SHARED_SKILLS } },
    language: { type: 'string', enum: LANGUAGES },
    needs_practical_ruling: { type: 'boolean' },
    community_dependent: { type: 'boolean' },
    off_topic: { type: 'boolean' },
  },
}

const SYSTEM = `You route messages for a Torah study assistant. Classify the LATEST user message (earlier turns are context).

Domains (pick 1-2, primary first):
- tanakh_parasha: Tanakh, weekly parasha, biblical figures/narrative, commentators on Tanakh (Rashi, Ramban, Kli Yakar…), midrash, divrei Torah
- halacha_minhag: Jewish law and customs, what to do in practice, brachot rules, Shabbat/kashrut/family purity/holidays practice
- gemara_mishnah: Talmud Bavli/Yerushalmi, Mishnah, sugyot, daf, translating Talmudic texts
- kabbalah_chassidut: Zohar, Kabbalah, sefirot, chassidut (Tanya, Breslov, Baal Shem Tov, rebbes)
- machshava_mussar_life: Jewish thought and belief, afterlife, ethics/mussar, personal life questions, interfaith questions, non-Jewish seekers and conversion

Shared skills (any that apply):
- calendar: dates, parasha of the week, holidays, zmanim, Shabbat times, daily learning schedules
- word_meaning: meaning/etymology/grammar of Hebrew or Aramaic words, gematria
- translation: user asks to translate a text or pasted passage
- tefillah: prayers, siddur, brachot text and meaning
- long_form: user wants a long piece (dvar Torah, drasha, summary series) or to continue a previous long answer

language: the language the user writes in (not quoted sources). English with transliterated Hebrew terms = "en". Yiddish uses Hebrew letters with Germanic words (איז, נישט, וואס).
community_dependent: practice differs by community (Ashkenazi/Sephardi/Chabad/etc.).
off_topic: unrelated to Judaism/Torah (greetings and thanks are not off_topic).`

export async function routeMessage(
  client: Anthropic,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<Route> {
  // Only the last few turns matter for routing; keep it cheap.
  const recent = messages.slice(-5).map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 1500)}`).join('\n\n')
  try {
    const res = await client.messages.create({
      model: INTENT_MODEL.model,
      max_tokens: INTENT_MODEL.maxTokens,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: SYSTEM,
      messages: [{ role: 'user', content: recent }],
    })
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
    const r = JSON.parse(text) as Route
    if (!r.domains.length) r.domains = ['tanakh_parasha']
    r.domains = r.domains.slice(0, 2)
    return { ...r, usage: res.usage }
  } catch (e) {
    console.error('router failed, using defaults:', (e as Error).message)
    return {
      domains: ['tanakh_parasha'], shared_skills: [], language: 'other',
      needs_practical_ruling: false, community_dependent: false, off_topic: false,
    }
  }
}

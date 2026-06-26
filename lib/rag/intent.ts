import Anthropic from '@anthropic-ai/sdk'

export type IntentType =
  | 'text_lookup'
  | 'topic_exploration'
  | 'commentary_request'
  | 'comparative'
  | 'halachic'
  | 'word_definition'
  | 'general'
  | 'calendar_parasha'
  | 'calendar_learning'
  | 'calendar_shabbat'
  | 'calendar_zmanim'
  | 'calendar_holiday'
  | 'calendar_date'
  | 'calendar_general'

export interface CalendarParams {
  needs_location: boolean
  date_reference: string | null
  hebrew_date: { hy: number; hm: string; hd: number } | null
  gregorian_date: string | null
  learning_type: string | null
}

export interface ParsedIntent {
  type: IntentType
  refs: string[]
  topics: string[]
  search_terms_en: string[]
  search_terms_he: string[]
  category_hint: string | null
  calendar_params: CalendarParams | null
}

const INTENT_PROMPT = `You are a Torah reference classification system. Given a user question, extract structured information for retrieval.

Return ONLY valid JSON with these fields:
{
  "type": one of "text_lookup" | "topic_exploration" | "commentary_request" | "comparative" | "halachic" | "word_definition" | "general" | "calendar_parasha" | "calendar_learning" | "calendar_shabbat" | "calendar_zmanim" | "calendar_holiday" | "calendar_date" | "calendar_general",
  "refs": array of Sefaria-format references mentioned or implied (e.g. "Genesis 1:1", "Berakhot 2a", "Rashi on Genesis 1:2"),
  "topics": array of topic slugs or English topic names (e.g. "prayer", "shabbat", "free-will", "tzedakah"),
  "search_terms_en": array of 2-4 English search phrases to find relevant texts,
  "search_terms_he": array of Hebrew search terms if the question contains Hebrew,
  "category_hint": null or one of "Tanakh", "Talmud", "Midrash", "Halakhah", "Kabbalah", "Philosophy", "Liturgy",
  "calendar_params": null for non-calendar types, or {
    "needs_location": boolean (true for zmanim, shabbat times, parasha — anything location-sensitive),
    "date_reference": null or string like "today", "tomorrow", "this_week", "2026-06-17",
    "hebrew_date": null or {"hy": number, "hm": "MonthName", "hd": number} for date conversion from Hebrew,
    "gregorian_date": null or "YYYY-MM-DD" for date conversion from Gregorian,
    "learning_type": null or one of "daf_yomi", "mishna_yomi", "yerushalmi_yomi", "tanakh_yomi", "nach_yomi", "rambam_1", "rambam_3", "sefer_hamitzvos", "chofetz_chaim", "tehillim", "pirkei_avot", "tanya", "hayom_yom", "chumash_rashi", "all"
  }
}

Guidelines:
- "text_lookup": user asks about a specific text ("What does Genesis 1:1 say?")
- "topic_exploration": user asks about a concept ("What does Judaism say about X?")
- "commentary_request": user asks about commentators on a text ("What does Rashi say about...")
- "comparative": user compares views ("How do Rambam and Ramban differ on...")
- "halachic": user asks about Jewish law ("Is it permissible to...")
- "word_definition": user asks about the meaning of a Hebrew/Aramaic word
- "general": anything else that is not calendar-related

CALENDAR TYPES — use these when the user asks about Jewish calendar, schedule, or time:
- "calendar_parasha": weekly Torah portion, parashat hashavua, sedra, "what parasha is this week"
- "calendar_learning": Daf Yomi, Mishna Yomi, or any daily learning schedule, "what daf are we on"
- "calendar_shabbat": candle lighting, havdalah, when Shabbat starts or ends
- "calendar_zmanim": sunrise, sunset, davening times, halachic times, zmanim
- "calendar_holiday": when a specific holiday falls, next fast day, upcoming holidays, when is Chanukah/Pesach/etc.
- "calendar_date": Hebrew date conversion, "what is today's Hebrew date", convert between calendars
- "calendar_general": other calendar questions not fitting the above

Key rules for calendar detection:
- Any question with "this week", "today", "tomorrow", "when is", "what time" + Jewish observance → calendar type
- "What is the parasha" or "what are we reading this Shabbat" → calendar_parasha with needs_location=true
- Parasha, shabbat times, and zmanim ALWAYS need location (Israel and Diaspora can differ)
- If user asks ABOUT a parasha's content (meaning, themes), still classify as calendar_parasha but also include search_terms_en for the topic
- If user explicitly names a date for conversion, extract it into hebrew_date or gregorian_date
- Hebrew month names: Nisan, Iyyar, Sivan, Tamuz, Av, Elul, Tishrei, Cheshvan, Kislev, Tevet, Shvat, Adar, Adar1, Adar2

CHABAD DAILY STUDY — classify as "calendar_learning" with the matching learning_type:
- "tanya": daily Tanya study — "What's today's Tanya?", "What Tanya do we learn today?"
- "hayom_yom": Hayom Yom (daily insights from the Lubavitcher Rebbe) — "What is today's Hayom Yom?"
- "chumash_rashi": daily Chumash with Rashi (Chabad division) — "What is today's Chumash?", "daily Chumash with Rashi"
- "rambam_3": Rambam 3 chapters per day — "What Rambam chapters today?", "daily Rambam 3 chapters"
- "rambam_1": Rambam 1 chapter per day — "Rambam 1 chapter"
- "sefer_hamitzvos": Daily Mitzvah / Sefer HaMitzvos — "What is today's daily mitzvah?"
- If the user asks about "daily study" or "all daily learning" without specifying, use learning_type "all"

- Extract refs even if implied (e.g. "the first verse of the Torah" → "Genesis 1:1")
- Topics should be lowercase slug-like: "prayer", "shabbat", "free-will"
- search_terms_en should be concise phrases, not full sentences`

export async function classifyIntent(
  question: string,
  client: Anthropic
): Promise<ParsedIntent> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: question }],
    system: INTENT_PROMPT,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    let calendarParams: CalendarParams | null = null
    if (parsed.calendar_params && typeof parsed.calendar_params === 'object') {
      calendarParams = {
        needs_location: !!parsed.calendar_params.needs_location,
        date_reference: parsed.calendar_params.date_reference ?? null,
        hebrew_date: parsed.calendar_params.hebrew_date ?? null,
        gregorian_date: parsed.calendar_params.gregorian_date ?? null,
        learning_type: parsed.calendar_params.learning_type ?? null,
      }
    }

    return {
      type: parsed.type ?? 'general',
      refs: Array.isArray(parsed.refs) ? parsed.refs : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      search_terms_en: Array.isArray(parsed.search_terms_en) ? parsed.search_terms_en : [],
      search_terms_he: Array.isArray(parsed.search_terms_he) ? parsed.search_terms_he : [],
      category_hint: parsed.category_hint ?? null,
      calendar_params: calendarParams,
    }
  } catch {
    return {
      type: 'general',
      refs: [],
      topics: [],
      search_terms_en: [question],
      search_terms_he: [],
      category_hint: null,
      calendar_params: null,
    }
  }
}

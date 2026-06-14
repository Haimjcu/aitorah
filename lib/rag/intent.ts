import Anthropic from '@anthropic-ai/sdk'

export type IntentType =
  | 'text_lookup'
  | 'topic_exploration'
  | 'commentary_request'
  | 'comparative'
  | 'halachic'
  | 'word_definition'
  | 'general'

export interface ParsedIntent {
  type: IntentType
  refs: string[]
  topics: string[]
  search_terms_en: string[]
  search_terms_he: string[]
  category_hint: string | null
}

const INTENT_PROMPT = `You are a Torah reference classification system. Given a user question, extract structured information for retrieval.

Return ONLY valid JSON with these fields:
{
  "type": one of "text_lookup" | "topic_exploration" | "commentary_request" | "comparative" | "halachic" | "word_definition" | "general",
  "refs": array of Sefaria-format references mentioned or implied (e.g. "Genesis 1:1", "Berakhot 2a", "Rashi on Genesis 1:2"),
  "topics": array of topic slugs or English topic names (e.g. "prayer", "shabbat", "free-will", "tzedakah"),
  "search_terms_en": array of 2-4 English search phrases to find relevant texts,
  "search_terms_he": array of Hebrew search terms if the question contains Hebrew,
  "category_hint": null or one of "Tanakh", "Talmud", "Midrash", "Halakhah", "Kabbalah", "Philosophy", "Liturgy"
}

Guidelines:
- "text_lookup": user asks about a specific text ("What does Genesis 1:1 say?")
- "topic_exploration": user asks about a concept ("What does Judaism say about X?")
- "commentary_request": user asks about commentators on a text ("What does Rashi say about...")
- "comparative": user compares views ("How do Rambam and Ramban differ on...")
- "halachic": user asks about Jewish law ("Is it permissible to...")
- "word_definition": user asks about the meaning of a Hebrew/Aramaic word
- "general": anything else
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
    return {
      type: parsed.type ?? 'general',
      refs: Array.isArray(parsed.refs) ? parsed.refs : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      search_terms_en: Array.isArray(parsed.search_terms_en) ? parsed.search_terms_en : [],
      search_terms_he: Array.isArray(parsed.search_terms_he) ? parsed.search_terms_he : [],
      category_hint: parsed.category_hint ?? null,
    }
  } catch {
    return {
      type: 'general',
      refs: [],
      topics: [],
      search_terms_en: [question],
      search_terms_he: [],
      category_hint: null,
    }
  }
}

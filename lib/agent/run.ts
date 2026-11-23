// The agent loop: route → load skills → tool-using answer (streamed) → citation check.
// Self-hosted on the Messages API (owner decision), Sonnet 5.5 with Sefaria/Hebcal tools.
import Anthropic from '@anthropic-ai/sdk'
import { answerModelFor, INTENT_MODEL } from '@/lib/ai/models'
import type { ModelCall } from '@/lib/db/answer-logs'
import type { GeoInfo } from '@/lib/hebcal/types'
import { checkRef } from '@/lib/sefaria/verify'
import { BASE_PROMPT, buildUserContextBlock } from './base-prompt'
import { routeMessage, type Route } from './router'
import { loadSkills, skillSlugs, type LoadedSkill } from './skills'
import { toolDefinitions, runTool, type ToolContext } from './tools'

const MAX_TOOL_ROUNDS = 8
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export type AgentEvent =
  | { type: 'route'; domains: string[]; language: string }
  | { type: 'status'; tool: string; label: string }
  | { type: 'text'; delta: string }
  | { type: 'sources'; sources: AgentSource[] }
  | { type: 'citations'; cited: string[]; unverified: string[] }
  | { type: 'memory'; id: string; content: string; scope: 'user' | 'project' }
  | { type: 'profile'; changes: Record<string, string | null> }
  | { type: 'done'; stopReason: string | null; domains: string[]; skillVersions: Record<string, number | 'file'> }

export interface AgentSource {
  ref: string
  heRef?: string
  category?: string
  url: string
}

export interface AgentInput {
  messages: { role: 'user' | 'assistant'; content: string }[]
  geo?: GeoInfo | null
  profile?: { nusach?: string | null; level?: string | null; answerLanguage?: string | null } | null
  memories?: string[]
  projectMemories?: string[]
  projectTitle?: string | null
  projectId?: string | null
  /** Ready files in the project: shown to the model so it can call read_project_file. */
  projectFiles?: { id: string; filename: string; mime: string; description: string | null }[]
  /** Signed-in user id: enables memory/profile tools. */
  userId?: string | null
  plan?: string | null
  /** Evals: use these skill contents instead of the active versions. */
  skillOverrides?: Record<string, LoadedSkill>
  /** Evals/M2 baseline: skip domain skills entirely (base prompt only). */
  noSkills?: boolean
  onEvent?: (e: AgentEvent) => void
}

export interface AgentResult {
  answer: string
  route: Route
  sources: AgentSource[]
  stopReason: string | null
  calls: ModelCall[]
  toolCalls: { name: string; input: unknown; ms: number; isError: boolean }[]
  latencyMs: number
  ttftMs: number | null
  skillVersions: Record<string, number | 'file'>
  citations: { cited: string[]; unverified: string[] }
}

const TOOL_LABELS: Record<string, (i: Record<string, unknown>) => string> = {
  get_text: (i) => `Reading ${i.ref}`,
  search_texts: (i) => `Searching the library for “${i.query}”`,
  get_links: (i) => `Finding commentaries on ${i.ref}`,
  get_topic: (i) => `Looking up the topic “${i.slug}”`,
  find_ref: (i) => `Checking the reference “${i.name}”`,
  calendar: () => 'Checking the Jewish calendar',
  remember: () => 'Saving to memory',
  update_profile: () => 'Saving your preferences',
  read_project_file: () => 'Reading your uploaded file',
}

export const sefariaUrl = (ref: string) => `https://www.sefaria.org/${encodeURIComponent(ref.replace(/ /g, '_'))}`

export async function runAgent(client: Anthropic, input: AgentInput): Promise<AgentResult> {
  const started = Date.now()
  const emit = input.onEvent ?? (() => {})
  const calls: ModelCall[] = []

  // 1. Route
  const route = await routeMessage(client, input.messages)
  if (route.usage) calls.push({ model: INTENT_MODEL.model, usage: route.usage })
  const language = input.profile?.answerLanguage || (route.language === 'other' ? 'en' : route.language)
  emit({ type: 'route', domains: route.domains, language })

  // 2. Skills
  const slugs = input.noSkills ? [] : skillSlugs(route.domains, route.shared_skills)
  const loaded = (await loadSkills(slugs)).map((s) => input.skillOverrides?.[s.slug] ?? s)
  for (const [slug, s] of Object.entries(input.skillOverrides ?? {})) if (!loaded.some((l) => l.slug === slug) && slugs.includes(slug)) loaded.push(s)
  const skillVersions = Object.fromEntries(loaded.map((s) => [s.slug, s.version]))

  // 3. System prompt: [base] [skills] ← cache breakpoint, then per-user context (uncached)
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: 'text', text: BASE_PROMPT }]
  if (loaded.length) system.push({ type: 'text', text: loaded.map((s) => s.content).join('\n\n---\n\n') })
  system[system.length - 1].cache_control = { type: 'ephemeral' }
  system.push({
    type: 'text',
    text: buildUserContextBlock({
      language,
      nusach: input.profile?.nusach,
      level: input.profile?.level,
      memories: input.memories,
      projectMemories: input.projectMemories,
      projectTitle: input.projectTitle,
      projectFiles: input.projectFiles,
      signedIn: !!input.userId,
      communityDependent: route.community_dependent,
    }),
  })

  // 4. Tool loop (halacha questions use the halacha answer model)
  const answerModel = answerModelFor(route.domains[0])
  const ctx: ToolContext = {
    language, geo: input.geo ?? null, retrievedRefs: new Map(),
    userId: input.userId ?? undefined, plan: input.plan, projectId: input.projectId,
    notify: (e) => emit(e),
  }
  const tools = toolDefinitions(!!input.userId, !!input.projectFiles?.length) as Anthropic.Beta.BetaTool[]
  const convo: Anthropic.Beta.BetaMessageParam[] = input.messages.map((m) => ({ role: m.role, content: m.content }))
  const toolCalls: AgentResult['toolCalls'] = []
  let answer = ''
  let ttftMs: number | null = null
  let stopReason: string | null = null

  for (let round = 0; ; round++) {
    const lastRound = round >= MAX_TOOL_ROUNDS
    const stream = client.beta.messages.stream({
      model: answerModel.model,
      max_tokens: answerModel.maxTokens,
      output_config: { effort: answerModel.effort },
      system,
      tools,
      ...(lastRound ? { tool_choice: { type: 'none' as const } } : {}),
      messages: convo,
      cache_control: { type: 'ephemeral' },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    })
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        if (ttftMs === null) ttftMs = Date.now() - started
        answer += ev.delta.text
        emit({ type: 'text', delta: ev.delta.text })
      }
    }
    const final = await stream.finalMessage()
    calls.push({ model: final.model, usage: final.usage })
    stopReason = final.stop_reason
    // Append the full content unchanged (thinking blocks must be passed back as-is).
    convo.push({ role: 'assistant', content: final.content })

    if (final.stop_reason !== 'tool_use' || lastRound) break

    const uses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    for (const u of uses) emit({ type: 'status', tool: u.name, label: TOOL_LABELS[u.name]?.(u.input as Record<string, unknown>) ?? u.name })
    const results = await Promise.all(uses.map(async (u) => {
      const t0 = Date.now()
      const r = await runTool(u.name, u.input, ctx)
      toolCalls.push({ name: u.name, input: u.input, ms: Date.now() - t0, isError: r.isError })
      return { type: 'tool_result' as const, tool_use_id: u.id, content: r.content, is_error: r.isError }
    }))
    // All tool results go back in a single user message.
    convo.push({ role: 'user', content: results })
  }

  if (stopReason === 'refusal') {
    const note = answer ? '\n\n*The answer was interrupted. Please try rephrasing your question.*' : 'I wasn’t able to answer this question. Please try rephrasing it.'
    answer += note
    emit({ type: 'text', delta: note })
  }

  // 5. Citation check: every bracketed citation must be something we retrieved or a ref Sefaria resolves.
  const citations = await checkCitations(client, answer, ctx.retrievedRefs, calls)
  emit({ type: 'citations', ...citations })

  // 6. Sources shown to the user: retrieved refs that the answer cites, else the first few retrieved.
  const retrieved = [...ctx.retrievedRefs.entries()]
  const citedNorm = citations.cited.map(norm)
  let used = retrieved.filter(([ref]) => citedNorm.some((c) => c.startsWith(norm(ref)) || norm(ref).startsWith(c)))
  if (!used.length) used = retrieved.slice(0, 5)
  const sources = used.slice(0, 12).map(([ref, m]) => ({ ref, heRef: m.heRef, category: m.category, url: sefariaUrl(ref) }))
  emit({ type: 'sources', sources })
  emit({ type: 'done', stopReason, domains: route.domains, skillVersions })

  return {
    answer, route, sources, stopReason, calls, toolCalls,
    latencyMs: Date.now() - started, ttftMs, skillVersions, citations,
  }
}

const norm = (r: string) => r.toLowerCase().replace(/[^a-z0-9֐-׿]/g, '')

const BRACKET = /\[([^\[\]\n]{3,160})\](?!\()/g
const LOOKS_LIKE_REF = /\d|[֐-׿]/ // refs contain a number (chapter/daf/siman) or Hebrew

export function extractCitations(answer: string): string[] {
  const out = new Set<string>()
  for (const m of answer.matchAll(BRACKET)) {
    for (const part of m[1].split(/;\s*/)) {
      const ref = part.trim().replace(/^(see|cf\.)\s+/i, '')
      if (ref.length >= 3 && LOOKS_LIKE_REF.test(ref)) out.add(ref)
    }
  }
  return [...out]
}

async function resolves(ref: string, retrievedNorm: string[]): Promise<boolean> {
  const n = norm(ref)
  if (n && retrievedNorm.some((r) => r.startsWith(n) || n.startsWith(r))) return true
  // 'unknown' (network/rate limit) is not evidence of an invented source.
  return (await checkRef(ref)) !== 'invalid'
}

/** Translate citations written with localized book names ("Exode 12:2", "Бытие 1:1") to Sefaria English refs. */
async function normalizeRefs(client: Anthropic, refs: string[], calls: ModelCall[]): Promise<string[]> {
  try {
    const res = await client.messages.create({
      model: INTENT_MODEL.model,
      max_tokens: INTENT_MODEL.maxTokens,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['refs'], properties: { refs: { type: 'array', items: { type: 'string' } } } } },
      },
      system: 'Convert each Jewish text citation to Sefaria\'s canonical English reference format (e.g. "Exode 12:2" → "Exodus 12:2", "Rachi sur Genèse 1:1" → "Rashi on Genesis 1:1", "ברכות כו ב" → "Berakhot 26b"). Return the same number of items, same order. If unsure, return the input unchanged.',
      messages: [{ role: 'user', content: JSON.stringify(refs) }],
    })
    calls.push({ model: res.model, usage: res.usage })
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
    const out = (JSON.parse(text) as { refs: string[] }).refs
    return out.length === refs.length ? out : refs
  } catch {
    return refs
  }
}

async function checkCitations(client: Anthropic, answer: string, retrieved: Map<string, unknown>, calls: ModelCall[]) {
  const cited = extractCitations(answer).slice(0, 15)
  const retrievedNorm = [...retrieved.keys()].map(norm)
  let pending: string[] = []
  for (const ref of cited) if (!(await resolves(ref, retrievedNorm))) pending.push(ref)
  if (pending.length) {
    const normalized = await normalizeRefs(client, pending, calls)
    const still: string[] = []
    for (const [i, ref] of normalized.entries()) if (!(await resolves(ref, retrievedNorm))) still.push(pending[i])
    pending = still
  }
  return { cited, unverified: pending }
}

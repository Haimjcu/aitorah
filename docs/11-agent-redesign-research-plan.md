# 11 — Agent Platform Redesign: Research Plan

Status: **research plan, not started** · Created 2026-11-23

Goal: replace the single-prompt RAG pipeline with a skill-based, multi-agent Torah study platform. It adds evals, memory, user projects (with file and image uploads), a correction-driven self-learning loop, and six languages. Sefaria and Hebcal remain the only text and calendar sources.

This document lists **what we need to learn before we design**. Each phase ends with a written deliverable. The final output is a design doc (`12-agent-platform-design.md`) and an implementation plan.

---

## Where we start (code audit summary)

| Area | Today | Gap vs. target |
|---|---|---|
| Orchestration | `app/api/chat/route.ts` runs a fixed sequence: classify → retrieve → one Sonnet call | No agent loop; the model cannot search again, follow a link, or check a source |
| Intent | `lib/rag/intent.ts`: Haiku 4.5, 14 intent types (7 calendar), JSON parsed with regex | Intents are *query shapes* (lookup, comparative…), not *Torah domains*. No structured outputs. |
| Retrieval | `lib/rag/retrieval.ts`: parallel Sefaria strategies, top 8 by score | The same strategy is used for every domain. Halacha needs Shulchan Aruch and its commentaries; chassidut needs Tanya and Likutei Moharan. Nothing is domain-aware. |
| Prompt | `lib/ai/prompts.ts`: one ~60-line system prompt | No skills, versioning, or evals; changing it is a code deploy |
| Models | Hard-coded `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` | Previous generation; no central config |
| Memory | None. Full history is sent each turn. | No user, project, or agent memory |
| Projects/files | `study_sessions` (title + JSON messages). No uploads. | Need projects, files, images, project memory |
| Feedback | `app/api/feedback/route.ts` stub (console.log); `RlhfFeedback` type unused | Need a real corrections pipeline with approval tiers |
| i18n | English UI; `qa_pairs.language` column exists, defaults `en` | Need UI translation, RTL, answer-language control |
| Auth | NextAuth v5 JWT, Google + email/password, users in Postgres | Good base; keep it |
| Caching | Exact-match Q&A cache returns stored answers for first-turn questions | Must not bypass the new agent for project or memory-aware chats |

Reusable as-is: Sefaria client and its LRU caches, Hebcal resolver, geolocation, auth, R2 upload, rate limiting, the SEO Q&A pages.

---

## Phase 0 — Data access & privacy (blocker)

1. **Get read access to production Postgres.** The Postgres service has no public TCP proxy, so the URL in local `.env` is dead. Options, in order of preference:
   - (a) Temporarily enable a TCP proxy on the Postgres service, export, then disable it.
   - (b) Run a read-only export script inside Railway via `railway ssh` into `aitorah`.
   - (c) `pg_dump` from a Railway one-off.
2. **Export** `study_sessions` and `qa_pairs` to JSONL in a git-ignored folder, with `user_id` replaced by a salted hash and no emails or names.
3. Record basic counts: rows, date range, messages per session, users, and the share of logged-in vs. anonymous traffic.

**Deliverable:** `analysis/README.md` (git-ignored data, committed scripts) with corpus stats.

## Phase 1 — Chat corpus analysis → taxonomy, skills inventory, languages

Questions to answer:
- What are users actually asking? Build a **domain taxonomy** from the data. The starting hypothesis is: halacha, chassidut, gemara/Talmud, tanakh & parsha, mefarshim/commentary, kabbalah, machshava/philosophy, mussar/middot, tefillah/liturgy, minhag/customs, calendar/zmanim, Jewish history, Hebrew/Aramaic language, life & guidance questions, off-topic. Domains may merge or split based on the data.
- Within each domain, which **sub-types** appear (e.g. halacha → practical "can I", source-of-a-law, machloket comparison)? Sub-types drive skills.
- Which **languages and scripts** appear? Detect per message: Hebrew vs. Yiddish (they share a script, so this needs care), Russian, French, Spanish, transliterated Hebrew, and anything else. **Any language outside the six approved ones goes to the owner for approval.**
- Where did the current system **fail**? Look for follow-ups such as "that's wrong" or "source?", rephrased repeats, short abandoned sessions, and wrong or missing citations.
- Which **Sefaria strategies** produced the sources that were actually cited, per domain?

Method:
1. Classify every user turn with Claude Haiku 5.5 via the **Message Batches API** (50% cost) using structured outputs: `{domain, sub_type, language, script, needs_practical_ruling, turn_quality_signals}`.
2. Hand-review a stratified sample (~30 per domain) to validate the taxonomy. Revise and re-run if agreement is under ~90%.
3. Cluster within each domain to find sub-types and recurring question templates.
4. Pick 20–50 representative questions per domain, with known-good answers where possible. These become the **seed eval sets**.

**Deliverables:** `analysis/taxonomy-report.md` (domains, volumes, sub-types, example questions, failure modes); `analysis/languages.md` (counts plus any languages needing approval); seed eval sets in `evals/<domain>/*.jsonl`.

## Phase 2 — Skills design per domain

For each domain from Phase 1, research and write up:
- **Authoritative corpus and search path in Sefaria**. Examples:
  - Halacha: Mishneh Torah → Tur → Shulchan Aruch + Rema → Mishnah Berurah / Aruch HaShulchan → contemporary.
  - Chassidut: Tanya, Likutei Torah, Likutei Moharan, Kedushat Levi, Sefat Emet.
  - Gemara: daf + Rashi/Tosafot + Rishonim.
  - Which Sefaria endpoints (texts, links, related, topics, search with category filters) serve each step?
- **Citation conventions** per domain (siman/se'if, daf/amud, chapter/halacha).
- **Guardrails**:
  - Halacha: distinguish Ashkenazi/Sephardi/Chabad practice, label machloket, always point to a posek for personal rulings.
  - Kabbalah and chassidut: attribution of ideas to specific rebbes.
- **Coverage gaps**: what Sefaria lacks for the domain (e.g. limited Russian/Spanish translations, thin coverage of some chassidic works). The agent must say so rather than invent.
- **Skill format and storage**: markdown instructions + tool allowlist + examples, versioned in Postgres. Evaluate whether to use Anthropic's Skills API (`client.skills.*`, now GA) or app-managed skills injected into prompts.

**Deliverable:** one skill spec per domain in `docs/skills/<domain>.md` + a skill schema.

## Phase 3 — Agent harness architecture

Research and decide:
1. **Hosting the loop.**
   - Option A, self-hosted: Messages API + Tool Runner (`client.beta.messages.toolRunner`) inside the Next.js app on Railway. We own streaming, latency, and cost.
   - Option B, Anthropic Managed Agents: Anthropic hosts the loop and a sandbox, with built-in memory stores and skills. It is beta and bills session runtime on top of tokens.
   - Leaning A for the public chat (low latency, streaming UX, many short sessions). Evaluate B for long-running project analysis jobs and the offline self-learning loop.
2. **Topology**: router (domain + language + needs-tools) → domain specialist (skill-loaded) → optional verifier pass for citations. Decide whether multi-domain questions run several specialists or one with several skills.
3. **Tools**: wrap existing Sefaria and Hebcal clients as typed tools (`get_text`, `search`, `get_links`, `get_commentaries`, `get_topic`, `calendar_*`). Add `project_file_search` and `memory_read/write`. Use strict schemas.
4. **Streaming contract**: keep the `<!--SOURCES:...-->` prefix, or move to structured SSE events (tool progress, sources, text). Check impact on `ChatInterface.tsx` and the SEO cache.
5. **Prompt caching**: frozen system prompt + skill blocks first, volatile content after the breakpoint. Measure `cache_read_input_tokens`.
6. **Citation verification**: every cited ref must resolve in Sefaria. Unverifiable citations get flagged or removed.

**Deliverable:** architecture section of the design doc, with a sequence diagram.

## Phase 4 — Memory, projects, files

- **Memory layers**:
  - User profile: language, nusach/community, learning level, preferences.
  - Project memory: summaries and facts the user wants kept.
  - Domain/agent learnings: from the self-learning loop.
  - Decide the store: Postgres tables, or pgvector for semantic recall.
- **Long chats**: compaction (beta) vs. app-side summarization.
- **Projects**: schema (`projects`, `project_members`?, `project_files`, `project_memory`, link `study_sessions` → project), permissions, limits.
- **Uploads**:
  - Storage in R2 (already integrated).
  - Images (Hebrew manuscripts, sefer pages, handwritten notes) via Claude vision.
  - PDFs via document blocks.
  - Reuse across turns via the Files API (GA).
  - Hebrew OCR quality on scanned sefarim must be tested with real samples.
  - Size and type limits, virus/abuse checks.

**Deliverable:** data model + migration plan (Drizzle).

## Phase 5 — Evals & self-learning loop

- **Eval harness**: per-domain golden sets from Phase 1. Graders:
  - Deterministic: cited refs resolve, required sections present, correct language.
  - LLM judge with a domain rubric: halachic accuracy, correct attribution, machloket labeled, no invented sources.
  - Owner spot review.
- **Gating**: a skill or prompt version ships only if it is ≥ baseline on its domain and no regression elsewhere.
- **Corrections pipeline**: user flags an answer → correction captured with context → classified by risk:
  - **Auto-apply tier** (after passing evals): formatting, tone, missing source suggestion, translation fixes, retrieval hints.
  - **Owner-approval tier**: anything changing a halachic ruling, majority/minority labeling, attribution, doctrinal content, or safety guardrails.
  - Define these tiers precisely with the owner.
- **Learning loop**: a nightly batch job clusters corrections and eval failures. A strong model proposes skill diffs, the evals run, and each diff is either auto-merged (low tier) or put in the admin queue (the existing `ReviewQueue` pattern can be extended).
- Abuse resistance: the loop must handle bad-faith or wrong corrections (reputation, quorum, owner review).

**Deliverable:** eval + learning-loop section of the design doc; admin UI requirements.

## Phase 6 — Model selection

Candidates (Anthropic pricing as of 2026-11, $/1M input/output tokens):

| Model | ID | $ in / out | Candidate role |
|---|---|---|---|
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0.10 / 0.50 | Router, language detection, corpus classification (batch), cheap tool-heavy sub-steps |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 / 10 | Default domain specialist for chat answers |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 / 20 | Hard halacha / comparative questions, eval judge, skill-diff proposer in the learning loop |
| Claude Fable 5.2 | `claude-fable-5-2` | 8 / 40 | Probably not needed; benchmark only for the hardest halacha evals |

- The decision is made **by evals, not by assumption**. Run each domain's golden set across Sonnet 5.5 and Opus 5.5 at different effort levels. Measure quality, latency (time to first token matters for chat), and cost per answer.
- Also test Opus 5.5 at low effort as a single-model alternative to a cascade, since one model also means one prompt-cache namespace.
- API changes to plan for on the 5.x models: thinking is adaptive (no `budget_tokens`), forced `tool_choice` is removed (use `auto` + strict tools), refusal stop reason plus server-side `fallbacks`, and no assistant prefill.
- OpenAI stays only for DALL-E images on SEO pages (unchanged).

**Deliverable:** model matrix with measured numbers → `lib/ai/models.ts` config.

## Phase 7 — Languages

- **UI**: i18n library for the Next.js App Router (evaluate `next-intl`), locale routing, RTL layout for Hebrew and Yiddish, fonts (Noto Sans Hebrew covers Yiddish; check Cyrillic in Inter).
- **Answers**: answer in the user's language. Quote sources in the original Hebrew/Aramaic plus a translation in the user's language. Check how well Sefaria covers French, Spanish, and Russian translations (many texts are English/Hebrew only, so the agent translates and labels it as its own translation).
- **SEO**: localized `/answers` pages, hreflang, sitemap per locale. Decide whether to translate existing published Q&As.
- **Evals**: each domain's eval set needs samples in each language. Yiddish especially needs native review.

**Deliverable:** i18n section of the design doc.

## Phase 8 — Rollout & cost

- Feature flag: new agent endpoint alongside legacy `/api/chat`; A/B on a share of traffic; compare eval scores and user signals.
- Cost model per answer and per month at current traffic (from Phase 0 counts), and a budget alert.
- Observability: log tool calls, model, tokens, cache hits, skill versions per answer (needed for the learning loop anyway).

---

## Open decisions for the owner

1. **DB access**: OK to temporarily enable a public TCP proxy on Postgres for the export (option a), or prefer running inside Railway (option b)?
2. **Privacy**: confirm it's OK to analyze logged-in users' chats (anonymized), and whether the privacy policy needs an update before using chats for training skills.
3. **Correction tiers**: confirm the auto-apply vs. approval split in Phase 5, and whether trusted users (e.g. rabbis) should get elevated correction rights.
4. **Hosting**: self-hosted agent loop (recommended for chat) vs. Managed Agents.
5. **Community/nusach defaults**: should the agent default to a specific practice (e.g. Ashkenazi, Chabad) or ask the user?

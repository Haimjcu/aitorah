# 11 — Agent Platform Redesign: Research Plan

Status: **in progress (Phase 1)** · Created 2026-11-23 · Last updated 2026-11-23

Goal: replace the single-prompt RAG pipeline with a skill-based, multi-agent Torah study platform. It adds evals, memory, user projects (with file and image uploads), a correction-driven self-learning loop, and eight languages. Sefaria and Hebcal remain the only text and calendar sources.

This document lists **what we need to learn before we design**. Each phase ends with a written deliverable. The build plan is `docs/12-agent-platform-build-plan.md`. Owner decisions are at the bottom.

---

## Progress

| Phase | Status | Notes |
|---|---|---|
| 0. Data access & export | ✅ Done | 650 study sessions (2,800 user turns), 3,183 qa_pairs, 77 users. Anonymized export in `analysis/data/` (git-ignored). Temporary DB proxy deleted after each export. |
| — Interim model upgrade | ✅ Done (commit `b38ceb7`) | Sonnet 4.6 → Sonnet 5.5 (answers), Haiku 4.5 → Haiku 5.5 (classifier), central config `lib/ai/models.ts`, refusal/truncation handling, thinking-block fix in the classifier. |
| 1. Corpus analysis | ✅ Labels done; hand validation pending | 5,985 messages labeled by Haiku 5.5 (batch, $0.84). Full numbers: `analysis/taxonomy-report.md`. |
| 2–8 | ⏳ Next: Phase 2 skills | Proposed agent groups below. |

**Phase 1 results: topic share of all 5,985 messages**

| Domain | % | Notes |
|---|---|---|
| Chit-chat / meta | 17.7% | Mostly "continue" requests caused by truncated answers (fixed) |
| Tanakh & parasha | 12.8% | Biggest Torah topic; many divrei Torah / drasha requests |
| Halacha | 12.2% | 57% want a practical ruling; **41% depend on community** |
| Commentators (Rashi, Kli Yakar…) | 7.0% | Often summaries for divrei Torah; 18% pushback |
| Gemara | 5.8% | Much of it is translating sugyot into Russian; 15% pushback |
| Kabbalah / Zohar | 4.8% | Heavily French-speaking |
| Machshava | 4.1% | Afterlife, purpose of creation, proofs of God |
| Translation requests | 4.0% | Pasted Hebrew/Aramaic → Russian/English |
| Tefillah | 4.0% | 45% community-dependent |
| Life guidance, mussar, chassidut, Hebrew words, minhag, history, calendar, interfaith, midrash, mishnah, seekers | 1–3% each | Minhag is 79% community-dependent; history has the highest pushback (18%) |

Question shapes: follow-ups 24%, explanations 18%, source requests 10%, **challenges/corrections 9.6%**, practical rulings 7%, pasted-text translation 6%. Languages (all messages): English 74%, French 9%, mixed 6%, Russian 4%, Hebrew 1%, Spanish 1%, Portuguese 1%, German 0.2%, real Yiddish ~0. 1,752 messages use transliterated Hebrew.

**Proposed specialist agents (input to Phase 2):**
1. **Tanakh & Parasha**: Tanakh, parasha, commentators, midrash (~21%). Skills: verse lookup, commentator comparison, divrei Torah / drasha writing, long-form output.
2. **Halacha & Minhag**: halacha, minhag, practical tefillah and calendar questions (~16%). Skills: posek chain (Rambam → Shulchan Aruch → Mishnah Berurah…), community-practice handling (nusach profile), "ask your rabbi" guardrail.
3. **Gemara & Mishnah**: Gemara, Mishnah, and translation of their texts (~11%). Skills: sugya walkthrough, Rashi/Tosafot, faithful word-by-word translation into the user's language.
4. **Kabbalah & Chassidut** (~7%). Skills: Zohar/Tanya/Likutei Moharan sourcing, attribution to specific rebbes, avoiding speculative claims.
5. **Machshava, Mussar & Life**: philosophy, mussar, life guidance, interfaith, seekers (~11%). Skills: sensitive pastoral tone, non-Jewish seekers/Noahides, interfaith care.
6. **Shared skills** for all agents: calendar/zmanim tools, Hebrew/Aramaic word meaning, translation of pasted text, citation verification, continuation of long answers.

**Findings so far (before the topic classification):**
- qa_pairs grew from ~116 a month (June) to ~1,018 (October). 200 rows dated 2023-06 look like seed data.
- 315 of 650 sessions are a single question; the average is 4.3 user turns per session.
- Languages from a script-based first pass: English ≈ 5,300 messages, Hebrew ≈ 210, Russian ≈ 190, French ≈ 170, Spanish ≈ 30, Portuguese ≈ 20, German: a handful. No Yiddish detected yet; the AI pass will check.
- Users paste whole articles and ask for a translation, mostly into Russian. That is a distinct use case to support.
- The `qa_pairs.language` column is `en` for every row, so it is never actually filled in.
- The API key in local `.env` is invalid, and the `.env` `DATABASE_URL` points to a deleted proxy. Local dev needs fresh values.

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
- Which **languages and scripts** appear? Detect per message: Hebrew vs. Yiddish (they share a script, so this needs care), Russian, French, Spanish, Portuguese, German, transliterated Hebrew, and anything else. **Any language outside the eight approved ones goes to the owner for approval.**
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

- **UI**: i18n library for the Next.js App Router (evaluate `next-intl`), locale routing, RTL layout for Hebrew and Yiddish, fonts (Noto Sans Hebrew covers Yiddish; check Cyrillic and Portuguese/German diacritics in Inter).
- **Answers**: answer in the user's language. Quote sources in the original Hebrew/Aramaic plus a translation in the user's language. Check how well Sefaria covers French, Spanish, and Russian translations (many texts are English/Hebrew only, so the agent translates and labels it as its own translation).
- **SEO**: localized `/answers` pages, hreflang, sitemap per locale. Decide whether to translate existing published Q&As.
- **Evals**: each domain's eval set needs samples in each language. Yiddish especially needs native review.

**Deliverable:** i18n section of the design doc.

## Phase 8 — Rollout & cost

- Feature flag: new agent endpoint alongside legacy `/api/chat`; A/B on a share of traffic; compare eval scores and user signals.
- Cost model per answer and per month at current traffic (from Phase 0 counts), and a budget alert.
- Observability: log tool calls, model, tokens, cache hits, skill versions per answer (needed for the learning loop anyway).

---

## Owner decisions (2026-11-23)

1. **DB access**: temporary public TCP proxy on Postgres for exports, deleted right after each export. Scripts: `analysis/scripts/export.cjs`.
2. **Privacy**: approved to analyze logged-in users' chats, anonymized (salted user hash, no emails).
3. **Corrections: option D**, a hybrid of risk tiers and trusted reviewers:
   - Low-risk corrections (formatting, tone, typos, translation fixes, broken source links, retrieval hints) auto-apply after passing evals.
   - High-risk corrections (halachic ruling, majority/minority labeling, attribution, doctrinal content, safety guardrails) from trusted reviewers (e.g. rabbis the owner designates) are pre-reviewed by them, but **halachic changes always need final owner approval**.
   - Everyone else's high-risk corrections go to the owner queue.
   - Corrections change skills/prompts, never a stored answer directly.
4. **Hosting**: self-hosted agent loop on our own Railway server (Messages API + tool use), like today. No Managed Agents for the chat.
5. **Community/nusach**: ask the user once and save it to their profile. Answers lead with their practice and mention the others. When it is not set, present the main practices, each labeled.
6. **Languages**: English, Hebrew, French, Spanish, Russian, Yiddish, **plus Portuguese and German** (both found in chat history, approved). 8 total.
7. **Models (interim, live)**: Sonnet 5.5 for answers and Haiku 5.5 for the classifier, configured in `lib/ai/models.ts`. To be re-decided per route by evals in Phase 6.

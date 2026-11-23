# 12 — Agent Platform: Build Plan

Status: **decisions answered 2026-11-23; awaiting final go-ahead to start building** · Created 2026-11-23

Builds on `docs/11-agent-redesign-research-plan.md` (research, chat-corpus findings, owner decisions). This doc is the **how and in what order**.

---

## Build progress

| Milestone | Status | Notes |
|---|---|---|
| M0 Foundations | ✅ Done (committed) | SDK 1.12; migration `drizzle/0003_agent_platform.sql` (13 new tables + `study_sessions.project_id`, additive only); `lib/limits.ts` (all unlimited); `lib/flags.ts` kill switch; `answer_logs` written by legacy chat (tokens, cost, latency, TTFT, cache hits); `qa_pairs.language` filled; local dev via `scripts/dev-local.sh` + Docker Postgres; `npm run dev` uses webpack. Verified end-to-end with a French question. |
| M1 Eval harness | ✅ Built; baseline running | 255 eval cases in `evals/cases.jsonl` (7 languages, ~25% past failures, rubrics by Opus 5.5, 882/888 cited refs verified on Sefaria). Halacha review sheet for owner + rabbi: `evals/halacha-review.md` (40 cases). Runner `npm run eval -- --target legacy|agent` with Opus judge + Sefaria ref check; reports in `evals/runs/`. |
| M2 Agent harness | ✅ Built, tested locally | `lib/agent/` (router, tools, loop, citation check), `/api/agent` SSE endpoint (kill switch → legacy), ChatInterface streams status/sources, saves only first-turn Q&A. Uses server-side refusal fallbacks + prompt caching. |
| M3 Skills | 🔄 In progress | 5 domain + 5 shared skill packs in `skills/` (all example refs verified on Sefaria), versioned in DB via `scripts/seed-skills.ts`. **Halacha skill needs owner + rabbi approval.** Admin skill editor still to build. |
| M4–M8 | ⏳ | |

**Found during M2:** legacy retrieval calls Sefaria with `version=primary`, which returns Hebrew/Aramaic only, so the legacy prompt never gets Sefaria's English translations. The agent tools request Hebrew + English + the user's language.

**Found during M0 (production bug, legacy):** `/api/chat` saves *every* turn to `qa_pairs`, including follow-ups like "and without the a?", which then lack context on public SEO pages. The cache lookup only runs on first turns, but the save runs on all of them. Fix: save only first-turn answers (one-line change). Awaiting owner decision.

## 1. Principles

1. **Evals before agents.** Build the test harness first and score today's system. Every later milestone must beat that baseline on its domain before it ships.
2. **One launch, built on a branch.** Everything (M0–M7) is built on the `harness` branch, because pushing to `main` auto-deploys. It is tested on a Railway **staging** environment and released to production **in one deploy** (M8). A kill switch (`AGENT_ENABLED=false`) routes chat back to the legacy pipeline instantly if something goes wrong after launch.
3. **Data sources unchanged.** Sefaria and Hebcal only, now exposed as tools the agent calls.
4. **Skills and prompts are data, not code.** They are versioned in Postgres, editable from admin, and every answer records which versions produced it.
5. **Halacha is never auto-changed.** Correction option D: low-risk changes auto-apply after evals; high-risk changes from trusted reviewers get pre-reviewed by them; anything halachic needs final owner approval.
6. **Limits and budgets are built in but off.** Usage limits (projects, files, sizes, messages) live in one config with `null` = unlimited. API cost is logged per answer and shown in admin; there is no spending cap.

---

## 2. Target architecture

```
User ──► /api/agent (SSE stream)
          │
          ├─ 1. Load context: user profile (language, nusach, level), project memory + files, recent turns
          ├─ 2. Router — Haiku 5.5, structured output:
          │      { domain(s), language, needs_calendar, needs_practical_ruling, community_dependent }
          ├─ 3. Specialist agent — Sonnet 5.5, tool loop (self-hosted, Messages API)
          │      system = base prompt + domain skill(s) + shared skills + user/project memory
          │      tools  = sefaria_* · hebcal_* · project_files_search · memory_save
          │      loop until end_turn (max ~8 tool rounds, task budget)
          ├─ 4. Citation check — every cited ref resolved against Sefaria; unverifiable → flagged/removed
          └─ 5. Persist: message, sources, model, skill versions, tokens, latency → messages + answer_logs
                 (first-turn public answers still feed qa_pairs → SEO pages, unchanged)
```

**Five specialist domains** (from the corpus analysis):

| Agent | Covers | Share of traffic | Key skills |
|---|---|---|---|
| Tanakh & Parasha | Tanakh, parasha, commentators, midrash | ~21% | verse lookup, commentator comparison, divrei Torah / drasha writing |
| Halacha & Minhag | halacha, minhag, practical tefillah/calendar | ~16% | posek chain, community-practice handling, "ask your rabbi" guardrail |
| Gemara & Mishnah | Gemara, Mishnah, text translation | ~11% | sugya walkthrough, Rashi/Tosafot, faithful translation |
| Kabbalah & Chassidut | Zohar, Kabbalah, chassidut | ~7% | sourcing in Zohar/Tanya/Likutei Moharan, attribution |
| Machshava, Mussar & Life | philosophy, mussar, life guidance, interfaith, seekers | ~11% | pastoral tone, seekers/Noahides, interfaith care |

**Shared skills** (any agent can load them): calendar & zmanim, Hebrew/Aramaic word meaning, pasted-text translation, citation format, long-form continuation, language & RTL output rules.

**One agent, many skills.** The "specialists" are the same loop code loaded with different skill packs, not five separate codebases. A question that spans domains (e.g. a parasha question that is also halacha) loads both skill packs.

**Models** (from `lib/ai/models.ts`; final choice per route is decided by evals in M1/M3):

| Route | Model | Effort |
|---|---|---|
| Router | `claude-haiku-5-5` | low |
| Specialist answers | `claude-sonnet-5-5` | medium (halacha: test high) |
| Eval judge | `claude-opus-5-5` | high |
| Learning loop (proposes skill changes; batch) | `claude-opus-5-5` | high |
| Title / memory summarization | `claude-haiku-5-5` | low |

---

## 3. Data model (new tables, Drizzle)

| Table | Purpose | Key columns |
|---|---|---|
| `user_profiles` | Per-user settings | user_id, ui_language, answer_language, nusach (`ashkenaz`/`sefard`/`edot_hamizrach`/`chabad`/`other`/null), level, trusted_reviewer (bool) |
| `projects` | User projects | id, user_id, title, description, created_at |
| `project_files` | Uploads | id, project_id, r2_key, mime, size, anthropic_file_id, extracted_text, status |
| `memories` | User + project memory | id, user_id, project_id (nullable), content, source_message_id, created_at |
| `messages` | Normalized chat messages (replaces JSON blob for new chats) | id, session_id, role, content, sources jsonb, model, skill_versions jsonb, tokens jsonb, latency_ms |
| `skills` | Skill pack metadata | id, slug, domain, kind (`domain`/`shared`/`base_prompt`) |
| `skill_versions` | Versioned skill content | id, skill_id, version, content (markdown), tool_allowlist, status (`draft`/`active`/`retired`), created_by, eval_run_id |
| `corrections` | User corrections | id, message_id, user_id, text, category, risk_tier (`low`/`high`/`halachic`), status, reviewer_id |
| `change_proposals` | Proposed skill/prompt diffs | id, skill_id, from_version, proposed_content, rationale, source_correction_ids, eval_run_id, status |
| `eval_cases` | Golden questions | id, domain, language, question, rubric jsonb, must_cite[], source (`corpus`/`owner`/`correction`) |
| `eval_runs` / `eval_results` | Eval history | run config (models, skill versions), per-case scores, cost |
| `answer_logs` | Observability | message_id, route, tool calls, cache hits, refusal/max_tokens, cost |

Changes to existing tables:
- `study_sessions.project_id` (nullable)
- Start filling `qa_pairs.language` (today every row is `en`)

Existing `study_sessions.messages` JSON stays for old chats. A one-time script backfills them into `messages`.

---

## 4. Milestones

Time estimates are rough and assume one developer working with Claude Code. Each milestone ends with an owner review.

### M0: Foundations (~1 week)
- Upgrade `@anthropic-ai/sdk` from 0.102 to current. That enables server-side refusal `fallbacks` and the current tool-runner/stream helpers. Re-run the model smoke test.
- Drizzle migration for all §3 tables (empty and unused for now).
- Create a Railway **staging** environment that deploys from the `harness` branch (branch already exists) (its own Postgres with a copy of production data, its own Redis, deployed from the branch).
- Kill switch: `AGENT_ENABLED` env (on at launch; set to false to fall back to legacy).
- `lib/limits.ts`: per-plan limits (projects, files per project, max file size, messages per day), all `null` (unlimited) for now but enforced wherever they apply, so turning one on is a config change.
- `answer_logs` written by the **legacy** pipeline too, so the baseline has real cost, latency, and truncation numbers (this small change ships to production early, on its own).
- Fill `qa_pairs.language` from the router/classifier output.
- Fix local dev: fresh `.env` (API key, DB access instructions).

**Exit:** staging running from the branch; legacy logging live in production.

### M1: Eval harness + baseline (~1 week)
- Build eval sets from the corpus: ~40 questions per specialist domain + ~15 per shared skill, ≈ 280 cases.
  - Stratified by language (French, Russian, Hebrew, Spanish, Portuguese, German cases included).
  - Deduplicated (e.g. the 26× "Amos 3:7").
  - Drawn from `analysis/data/domain-examples.md` and the pushback messages, since those show where we failed.
- **Owner + rabbi review the Halacha set** and mark the expected rulings and community distinctions. I prepare it as a review sheet (question, draft expected answer, community notes) for the two of you to correct.
- Graders:
  - **Deterministic:** cited refs resolve in Sefaria; answer language matches; required structure present; not truncated.
  - **LLM judge** (Opus 5.5) with per-domain rubric: accuracy, attribution, machloket labeled, community practices handled, no invented sources, tone.
- Runner: `npm run eval -- --domain halacha --target legacy|agent`. Results go to `eval_runs`, with a summary in admin.
- **Baseline run on today's legacy system.**

**Exit:** baseline scores per domain and language. Cost per full run is measured (estimate ~$20–40).

### M2: Agent harness + tools (~2 weeks)
- `lib/agent/`: router, loop, tool registry, context builder, citation checker.
- Tools (typed, strict schemas) wrapping existing clients:
  - `sefaria_get_text`, `sefaria_search`, `sefaria_links`, `sefaria_commentaries`, `sefaria_topic`, `sefaria_related`
  - `hebcal_calendar`, `hebcal_zmanim`, `hebcal_convert_date`
- Self-hosted manual loop on the Messages API with streaming (more control over SSE progress events than the beta tool runner). Prompt caching on the base prompt + skill blocks. Max tool rounds and a task budget.
- New streaming protocol (SSE): `status` (e.g. "Searching Shulchan Aruch…"), `sources`, `text`, `done` (message id). `ChatInterface.tsx` supports both protocols during the transition.
- `/api/agent` on staging. It first runs with a **single generic skill** (today's prompt, converted) so we compare harness vs. legacy fairly.

**Exit:** the agent with a generic skill is ≥ baseline on evals; p50 time-to-first-token is acceptable (target < 3s with progress events).

### M3: Skills + specialists (~2 weeks)
- Skill store (`skills`, `skill_versions`) + admin editor with version history and "run evals on this version".
- Write the five domain skill packs + shared skills (detailed specs come from research Phase 2). Each skill includes:
  - Sefaria search path
  - Authoritative sources
  - Citation format
  - Guardrails
  - Worked examples
- Router picks skill packs; nusach from the profile shapes Halacha/Minhag answers.
- **Owner + rabbi approve the Halacha & Minhag skill content before launch.**
- Evals: each domain must beat the M1 baseline with no regressions elsewhere. Tune effort per domain (test Opus 5.5 on halacha if Sonnet falls short).

**Exit:** every domain beats the legacy baseline on staging.

### M4: Accounts, profile, projects, memory (~2 weeks)
- Profile page: languages, nusach (asked once in chat when first relevant, then saved), level.
- Projects: create/rename/delete, sessions inside projects, project page.
- Memory:
  - **User memory:** preferences and facts the user says to remember.
  - **Project memory:** auto-summarized key points + manual pins.
  - The agent gets `memory_save` (writes need user-visible confirmation) and memory is injected into context.
  - Users can view and delete their memories.
- Long chats: summarize older turns (or API compaction) instead of resending everything.

**Exit:** logged-in users have projects with persistent memory.

### M5: Files & images (~1 week)
- Upload to R2 (images, PDFs, text; size and type limits). Send to Claude via the Files API (images/PDFs as content blocks; extracted text cached for search).
- `project_files_search` tool.
- **Hebrew OCR test** on real scanned sefer pages before launch.
- Uploaded and pasted content is treated as **data, not instructions** (prompt-injection guard in the base prompt and tool design).

**Exit:** users can ask about uploaded sefer pages and notes inside a project.

### M6: Corrections + learning loop (~2 weeks)
- "Suggest a correction" on every answer (replaces the stub `/api/feedback`). Captures the message, the user's text, and a category.
- Auto risk classification (Haiku) → `low` / `high` / `halachic`.
- Option D routing:
  - **low** → learning loop, auto-apply if evals pass.
  - **high** from a trusted reviewer → that reviewer's pre-review → owner queue. (The trusted-reviewer role is built, but no reviewers are assigned at launch, so all high-risk corrections go to the owner.)
  - **high** from others → owner queue.
  - **halachic** → always ends with owner approval.
- Nightly learning loop (batch, Opus 5.5):
  1. Cluster corrections + eval failures.
  2. Propose skill diffs.
  3. Run evals on the proposed version.
  4. Auto-activate (low tier, no regressions) or queue for approval.
  - Corrections become new eval cases, so regressions are caught.
- Admin queue: diff view, eval comparison, approve/reject, one-click rollback to any version. Extends today's `ReviewQueue`.
- Abuse limits: rate limit per user, ignore corrections from new/flagged accounts for auto-apply.

**Exit:** a correction can flow end-to-end to a new active skill version, with an audit trail.

### M7: Languages (~2 weeks, can run in parallel with M4–M6)
- `next-intl` with locales `en, he, fr, es, ru, yi, pt, de`. RTL for `he` and `yi`. Language switcher; the profile stores the preference.
- UI strings translated by Claude, with native review for Hebrew, French, and Russian (the biggest non-English groups).
- Answers: reply in the user's language. Quote sources in the original Hebrew/Aramaic plus a translation. When Sefaria has no translation in that language, label the translation as the AI's own.
- SEO: localized `/answers` pages with hreflang, only for languages that have real traffic (French first).

**Exit:** the full UI works in 8 languages; answer-language evals pass.

### M8: Launch (~1–2 weeks)
- **Pre-launch gate** (all required):
  - Every domain ≥ legacy baseline on evals, all 8 languages included.
  - Halacha skill and evals signed off by owner + rabbi.
  - Staging soak: owner and a few testers use staging for a week.
  - Migrations rehearsed on the staging copy of production data.
  - Load check against Sefaria rate limits.
- **Launch:** merge `harness` → `main` (one deploy), run migrations, backfill old sessions into `messages`.
- **Watch** for the first weeks via admin metrics:
  - continue-request rate (was 13%)
  - pushback rate (~8.6% excluding "continue")
  - refusals
  - latency
  - daily cost
- Kill switch ready.
- Once stable: remove `/api/chat`, `lib/ai/prompts.ts`, and old intent types. Keep the `qa_pairs` → SEO page flow fed by the agent. Update `CLAUDE.md` and `ARCHITECTURE.md`.

**Total:** roughly 12–15 weeks to a single launch (~10–12 with M7 in parallel). Nothing user-visible changes in production until launch, except early legacy logging.

---

## 5. Cost estimate (to be replaced by M0/M1 measurements)

| Item | Estimate |
|---|---|
| Agent answer (Sonnet 5.5, ~5 tool rounds, caching) | ~$0.04–0.10 per answer |
| Router (Haiku 5.5) | < $0.001 per message |
| Current volume (~1,000 qa/month + session turns, ~3,000 answers/month) | ~$150–300 / month (no cap; owner monitors the admin cost view and the Anthropic console) |
| Full eval run (~280 cases + Opus judge) | ~$20–40 per run |
| Nightly learning loop (batch, 50% off) | ~$1–5 / night |

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Wrong halachic answers or community mixups | Owner-reviewed halacha evals and skill; citation check; owner approval for every halachic change |
| Agent is slower than one call | Progress events in the stream; cap tool rounds; prompt caching; tune effort |
| Sefaria rate limits from more tool calls | Existing LRU caches; per-request tool budget; back off on 429 |
| Prompt injection via uploads, pasted texts, or corrections | Treat as data; corrections never edit prompts directly (only via proposals + evals) |
| Bad-faith corrections | Option D tiers, account age/reputation, owner queue |
| Breaking SEO pages | `qa_pairs` flow unchanged; legacy stays until M8 |
| Yiddish has no real usage data | Ship UI and answers, but treat evals as low-confidence until native review |

---

## 7. Owner decisions (2026-11-23)

1. **Order** doesn't matter: everything launches in **one deploy**. Built on a branch, tested on staging (see Principles and M8).
2. **Five specialist domains**: approved as listed.
3. **Trusted reviewers**: none for now. The role exists in code; all high-risk corrections go to the owner.
4. **Usage limits**: none now, but built into the code (`lib/limits.ts`, `null` = unlimited) so they can be turned on later.
5. **API budget**: no cap. The owner monitors; cost is logged per answer and shown in admin.
6. **Halacha evals**: the owner reviews them with a rabbi.
7. **SDK upgrade**: approved (M0), verified with build + live smoke test.

**Remaining:** final go-ahead to start building, and OK to create the Railway staging environment (adds a second Postgres/Redis/app instance to the `ai-torah` project, so a small extra monthly Railway cost).

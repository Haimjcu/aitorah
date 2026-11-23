// Select eval candidate questions from the labeled chat corpus.
// Output (private, git-ignored): analysis/data/eval-candidates.jsonl
// Next step (draft-evals.ts) scrubs personal details and drafts rubrics; that output is committable.
const fs = require('fs')
const D = 'analysis/data'
const read = (f) => fs.readFileSync(`${D}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

// Eval domain -> corpus labels it draws from, and how many cases to pick.
const PLAN = {
  tanakh_parasha: { from: ['tanakh_parsha', 'mefarshim_commentary', 'midrash_aggadah'], n: 40 },
  halacha_minhag: { from: ['halacha', 'minhag_customs'], n: 40 },
  gemara_mishnah: { from: ['gemara_talmud', 'mishnah'], n: 40 },
  kabbalah_chassidut: { from: ['kabbalah_zohar', 'chassidut'], n: 40 },
  machshava_mussar_life: { from: ['machshava_philosophy', 'mussar_middot', 'life_guidance', 'interfaith_comparative', 'conversion_non_jewish_seeker'], n: 40 },
  shared_calendar: { from: ['calendar_zmanim'], n: 15 },
  shared_tefillah: { from: ['tefillah_liturgy'], n: 15 },
  shared_word_meaning: { from: ['hebrew_aramaic_language'], n: 15 },
  shared_translation: { from: ['translation_request'], n: 15, allowPasted: true },
}
const NON_EN_SHARE = 0.3
const OVERSAMPLE = 1.5 // drafting drops questions that are not standalone (qa_pairs also stores follow-ups)
const LANG_MAP = { english: 'en', hebrew: 'he', french: 'fr', spanish: 'es', russian: 'ru', yiddish: 'yi', portuguese: 'pt', german: 'de' }

// Texts and session structure
const text = {}, qaStatus = {}
for (const q of read('qa_pairs.jsonl')) { text[`qa_${q.id}`] = q.question; qaStatus[`qa_${q.id}`] = q.status }
const sessionTurns = {} // sessionId -> [{id, idx}]
for (const s of read('study_sessions.jsonl')) {
  (Array.isArray(s.messages) ? s.messages : []).forEach((m, i) => {
    if (m.role !== 'user') return
    const id = `ss_${s.id}_${i}`
    text[id] = String(m.content ?? '')
    ;(sessionTurns[s.id] ||= []).push(id)
  })
}
const labels = read('labels.jsonl')
const byId = Object.fromEntries(labels.map((l) => [l.id, l]))

// A question "failed" if the user's next turn in the session pushed back (excluding plain "continue" requests),
// or if the admin queue rejected its qa_pairs answer.
const CONTINUE = /^\s*(continue|continu|продолж|suite|et suite|weiter|go on|keep going|more|next|ещё|еще|далее)\b/i
const failed = new Set()
for (const turns of Object.values(sessionTurns)) {
  for (let i = 0; i + 1 < turns.length; i++) {
    const next = byId[turns[i + 1]]
    if (next?.dissatisfaction && !CONTINUE.test(text[turns[i + 1]] ?? '')) failed.add(turns[i])
  }
}
for (const [id, st] of Object.entries(qaStatus)) if (st === 'rejected') failed.add(id)

const isFirstTurn = (id) => id.startsWith('qa_') || id.endsWith('_0') || sessionTurns[id.split('_')[1]]?.[0] === id
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80)

const used = new Set()
const out = []
const report = []
for (const [evalDomain, cfg] of Object.entries(PLAN)) {
  let pool = labels.filter((l) => {
    const t = text[l.id] ?? ''
    return cfg.from.includes(l.domain) &&
      LANG_MAP[l.language] &&
      !['followup_clarification', 'chitchat', 'other'].includes(l.shape) &&
      (cfg.allowPasted || !l.contains_pasted_text) &&
      isFirstTurn(l.id) &&
      t.length >= 15 && t.length <= (cfg.allowPasted ? 2500 : 700)
  })
  // dedupe within pool and across domains
  const seen = new Set()
  pool = pool.filter((l) => { const k = norm(text[l.id]); if (seen.has(k) || used.has(k)) return false; seen.add(k); return true })
  // shuffle deterministically, failures first within each language bucket
  const rnd = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h }
  pool.sort((a, b) => (failed.has(b.id) - failed.has(a.id)) || (rnd(a.id) - rnd(b.id)))

  const want = Math.round(cfg.n * OVERSAMPLE)
  const nonEnTarget = Math.round(want * NON_EN_SHARE)
  const picked = []
  // round-robin across non-English languages
  const buckets = {}
  for (const l of pool) if (l.language !== 'english') (buckets[l.language] ||= []).push(l)
  const langs = Object.keys(buckets)
  while (picked.length < nonEnTarget && langs.some((g) => buckets[g].length)) {
    for (const g of langs) if (buckets[g].length && picked.length < nonEnTarget) picked.push(buckets[g].shift())
  }
  // English: ~1/3 failures, rest mixed
  const en = pool.filter((l) => l.language === 'english')
  const enFail = en.filter((l) => failed.has(l.id)), enOk = en.filter((l) => !failed.has(l.id))
  const needEn = want - picked.length
  const failQuota = Math.min(enFail.length, Math.round(needEn / 3))
  picked.push(...enFail.slice(0, failQuota), ...enOk.slice(0, needEn - failQuota))
  if (picked.length < want) picked.push(...enFail.slice(failQuota, failQuota + want - picked.length))

  picked.forEach((l, rank) => {
    used.add(norm(text[l.id]))
    out.push({
      source_id: l.id, eval_domain: evalDomain, corpus_domain: l.domain, sub_topic: l.sub_topic, shape: l.shape,
      language: LANG_MAP[l.language], failed_before: failed.has(l.id),
      needs_practical_ruling: l.needs_practical_ruling, community_dependent: l.community_dependent,
      target: cfg.n, rank,
      question: text[l.id],
    })
  })
  const langCount = picked.reduce((a, l) => ((a[LANG_MAP[l.language]] = (a[LANG_MAP[l.language]] || 0) + 1), a), {})
  report.push(`${evalDomain}: ${picked.length} candidates for ${cfg.n} (pool ${pool.length}) failures ${picked.filter((l) => failed.has(l.id)).length} langs ${JSON.stringify(langCount)}`)
}
fs.writeFileSync(`${D}/eval-candidates.jsonl`, out.map((o) => JSON.stringify(o)).join('\n'))
console.log(report.join('\n'))
console.log(`total ${out.length}, known failures overall ${failed.size}`)

// Aggregate labels.jsonl into a taxonomy report.
//   analysis/taxonomy-report.md        — aggregates only (safe to commit)
//   analysis/data/domain-examples.md   — example user questions per domain (private, git-ignored)
const fs = require('fs')
const D = 'analysis/data'
const read = (f) => fs.readFileSync(`${D}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

const text = {}
for (const q of read('qa_pairs.jsonl')) text[`qa_${q.id}`] = q.question
for (const s of read('study_sessions.jsonl')) (Array.isArray(s.messages) ? s.messages : []).forEach((m, i) => { if (m.role === 'user') text[`ss_${s.id}_${i}`] = String(m.content ?? '') })

const labels = read('labels.jsonl')
const N = labels.length
const count = (arr) => arr.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})
const sorted = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])
const pct = (n, d = N) => `${((100 * n) / d).toFixed(1)}%`
const src = (l) => (l.id.startsWith('qa_') ? 'qa' : 'ss')

let md = `# Chat Corpus Taxonomy Report\n\nGenerated ${new Date().toISOString().slice(0, 10)} from ${N} user messages `
md += `(${labels.filter((l) => src(l) === 'qa').length} qa_pairs questions + ${labels.filter((l) => src(l) === 'ss').length} study_sessions user turns). Labels by Claude Haiku 5.5 (unvalidated; see "Validation" below).\n\n`

// Domains
const byDomain = {}
for (const l of labels) (byDomain[l.domain] ||= []).push(l)
md += `## Domains\n\n| Domain | Messages | % | qa_pairs | sessions | Practical ruling | Community-dependent | Dissatisfied | Top sub-topics |\n|---|---|---|---|---|---|---|---|---|\n`
for (const [d, ls] of Object.entries(byDomain).sort((a, b) => b[1].length - a[1].length)) {
  const subs = sorted(count(ls.map((l) => l.sub_topic.toLowerCase().trim()))).slice(0, 6).map(([k, n]) => `${k} (${n})`).join('; ')
  md += `| ${d} | ${ls.length} | ${pct(ls.length)} | ${ls.filter((l) => src(l) === 'qa').length} | ${ls.filter((l) => src(l) === 'ss').length} | ${pct(ls.filter((l) => l.needs_practical_ruling).length, ls.length)} | ${pct(ls.filter((l) => l.community_dependent).length, ls.length)} | ${pct(ls.filter((l) => l.dissatisfaction).length, ls.length)} | ${subs} |\n`
}

// Secondary domain co-occurrence
const co = count(labels.flatMap((l) => l.secondary_domains.filter((s) => s !== l.domain).map((s) => `${l.domain} + ${s}`)))
md += `\n## Most common domain combinations (primary + secondary)\n\n` + sorted(co).slice(0, 15).map(([k, n]) => `- ${k}: ${n}`).join('\n') + '\n'

// Shapes
md += `\n## Question shapes\n\n| Shape | Messages | % |\n|---|---|---|\n` + sorted(count(labels.map((l) => l.shape))).map(([k, n]) => `| ${k} | ${n} | ${pct(n)} |`).join('\n') + '\n'

// Languages
md += `\n## Languages\n\n| Language | Messages | % | qa_pairs | sessions |\n|---|---|---|---|---|\n`
for (const [k, n] of sorted(count(labels.map((l) => l.language))))
  md += `| ${k} | ${n} | ${pct(n)} | ${labels.filter((l) => l.language === k && src(l) === 'qa').length} | ${labels.filter((l) => l.language === k && src(l) === 'ss').length} |\n`
const other = sorted(count(labels.filter((l) => l.language_other).map((l) => l.language_other.toLowerCase().trim())))
md += `\nOther / mixed languages named: ${other.length ? other.map(([k, n]) => `${k} (${n})`).join(', ') : 'none'}\n`
md += `\nTransliterated Hebrew: ${labels.filter((l) => l.transliterated_hebrew).length} messages. Pasted text/articles: ${labels.filter((l) => l.contains_pasted_text).length}.\n`

// Language x domain for non-English
md += `\n## Non-English messages by domain\n\n`
for (const lang of ['hebrew', 'russian', 'french', 'spanish', 'portuguese', 'german', 'yiddish', 'mixed', 'other']) {
  const ls = labels.filter((l) => l.language === lang)
  if (ls.length) md += `- **${lang}** (${ls.length}): ` + sorted(count(ls.map((l) => l.domain))).slice(0, 6).map(([k, n]) => `${k} ${n}`).join(', ') + '\n'
}

// Dissatisfaction
const dis = labels.filter((l) => l.dissatisfaction)
md += `\n## Dissatisfaction signals\n\n${dis.length} messages (${pct(dis.length)}) push back on a previous answer. By domain: ` + sorted(count(dis.map((l) => l.domain))).map(([k, n]) => `${k} ${n}`).join(', ') + '\n'

md += `\n## Validation & interpretation (manual checks, 2026-11-23)\n
- **Yiddish is a mislabel.** 88 of 90 "yiddish" messages are the Hebrew greeting "מה נישמע" from 2 users. Real Yiddish usage is ~0. Keep Yiddish as an approved language, but no eval data exists for it.
- **~781 messages (13%) are "continue" requests.** Answers were cut off by the old 2,048 max_tokens limit (raised to 16,000 in commit b38ceb7). These dominate \`meta_app_chitchat\` and its 25% "dissatisfied" rate. Excluding them, content pushback is ~8.6% of messages.
- **Session languages are concentrated**: French session messages come from 6 users and Russian from 4. Use per-user weighting before sizing language work. qa_pairs (mostly anonymous) is the better signal.
- **Repeated items**: "Amos 3:7 KJV" appears 26 times (likely one user or a test). Deduplicate before building eval sets.
- **Other languages found** (not approved): Dutch 1 real message (Talmud translation request). Turkish, Finnish, Romanian, and Arabic hits are typos or single words. Nothing else needs approval.
- Still TODO: hand-review ~30 random messages per domain (\`analysis/data/domain-examples.md\`) and record label agreement.\n`
fs.writeFileSync('analysis/taxonomy-report.md', md)

// Private examples
let ex = `# Example questions per domain (PRIVATE — do not commit)\n`
for (const [d, ls] of Object.entries(byDomain).sort((a, b) => b[1].length - a[1].length)) {
  ex += `\n## ${d} (${ls.length})\n\n`
  const sample = [...ls].sort(() => Math.random() - 0.5).slice(0, 30)
  for (const l of sample) ex += `- [${l.language}/${l.shape}/${l.sub_topic}] ${String(text[l.id] ?? '').replace(/\s+/g, ' ').slice(0, 220)}\n`
}
fs.writeFileSync(`${D}/domain-examples.md`, ex)
console.log(md)

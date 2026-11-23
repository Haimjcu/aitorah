// Build a blind human-grading set: 15 questions x 2 answers (legacy + agent baselines), randomized codes.
// Output: evals/blind-grading/items.json (no system/AI-score info) and analysis/data/blind-key.json (private key).
const fs = require('fs'), crypto = require('crypto')
const rd = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse)
const [legacyFile, agentFile] = process.argv.slice(2)
const L = Object.fromEntries(rd(legacyFile).map((r) => [r.key, r]))
const A = Object.fromEntries(rd(agentFile).map((r) => [r.key, r]))
const cases = Object.fromEntries(rd('evals/cases.jsonl').map((c) => [c.id, c]))
const QUOTA = { halacha_minhag: 3, tanakh_parasha: 3, gemara_mishnah: 2, kabbalah_chassidut: 2, machshava_mussar_life: 2, shared_calendar: 1, shared_tefillah: 1, shared_word_meaning: 1 }
const seed = (s) => crypto.createHash('sha1').update('blind-v1' + s).digest().readUInt32BE(0)
const picked = []
for (const [domain, n] of Object.entries(QUOTA)) {
  const pool = Object.keys(cases).filter((k) => cases[k].domain === domain && ['en', 'he'].includes(cases[k].language) && L[k] && A[k] && !L[k].error && !A[k].error && L[k].answer && A[k].answer)
  // spread of AI scores: sort by |agent - legacy| desc and mix, include at least one Hebrew where available
  pool.sort((a, b) => seed(a) - seed(b))
  const he = pool.filter((k) => cases[k].language === 'he')
  const chosen = [...(he.length && n >= 2 ? [he[0]] : []), ...pool.filter((k) => k !== he[0])].slice(0, n)
  picked.push(...chosen)
}
const items = [], key = []
for (const k of picked) {
  for (const [sys, r] of [['legacy', L[k]], ['agent', A[k]]]) {
    const code = crypto.createHash('sha1').update('blind-v1' + k + sys).digest('hex').slice(0, 6).toUpperCase()
    items.push({ code, key: k, domain: cases[k].domain, language: cases[k].language, question: cases[k].question, answer: r.answer })
    key.push({ code, key: k, system: sys, ai: { overall: r.scores.overall, accuracy: r.scores.accuracy, sourcing: r.scores.sourcing, passed: r.passed } })
  }
}
items.sort((a, b) => seed(a.code) - seed(b.code))
fs.writeFileSync('evals/blind-grading/items.json', JSON.stringify(items, null, 1))
fs.writeFileSync('analysis/data/blind-key.json', JSON.stringify(key, null, 1))
const c = {}; items.forEach((i) => (c[i.domain + '/' + i.language] = (c[i.domain + '/' + i.language] || 0) + 1))
console.log(items.length, 'answers', c, 'AI overall spread:', key.map((k) => k.ai.overall).sort().join(''))

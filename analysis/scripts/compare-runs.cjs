// Compare eval runs on their shared case keys (optionally restricted to a split).
//   node analysis/scripts/compare-runs.cjs [--split train|test] label=file.jsonl ...
const fs = require('fs'), crypto = require('crypto')
const args = process.argv.slice(2)
const split = args.includes('--split') ? args[args.indexOf('--split') + 1] : null
const runs = args.filter((a) => a.includes('=')).map((a) => { const [label, f] = a.split('='); return { label, rows: Object.fromEntries(fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse).filter((r) => !r.error).map((r) => [r.key, r])) } })
const inSplit = (k) => !split || (crypto.createHash('sha1').update(k).digest()[0] % 2 === 0 ? 'train' : 'test') === split
const keys = Object.keys(runs[0].rows).filter((k) => inSplit(k) && runs.every((r) => r.rows[k]))
const stat = (rows, f) => (keys.reduce((s, k) => s + f(rows[k]), 0) / keys.length)
console.log(`shared cases: ${keys.length}${split ? ' (' + split + ' split)' : ''}`)
console.log('run'.padEnd(14), 'pass  overall accuracy sourcing keypts  latency  $/ans')
for (const r of runs) {
  console.log(r.label.padEnd(14), (stat(r.rows, (x) => +x.passed) * 100).toFixed(0).padStart(3) + '%',
    stat(r.rows, (x) => x.scores.overall).toFixed(2).padStart(7), stat(r.rows, (x) => x.scores.accuracy).toFixed(2).padStart(8),
    stat(r.rows, (x) => x.scores.sourcing).toFixed(2).padStart(8), (stat(r.rows, (x) => x.scores.key_point_coverage) * 100).toFixed(0).padStart(6) + '%',
    (stat(r.rows, (x) => x.latencyMs) / 1000).toFixed(0).padStart(7) + 's', stat(r.rows, (x) => x.costUsd).toFixed(3).padStart(6))
}
const domains = [...new Set(keys.map((k) => runs[0].rows[k].domain))]
console.log('\npass rate by domain:', runs.map((r) => r.label).join(' / '))
for (const d of domains) {
  const ks = keys.filter((k) => runs[0].rows[k].domain === d)
  console.log(' ', d.padEnd(24), ks.length, runs.map((r) => (ks.filter((k) => r.rows[k].passed).length / ks.length * 100).toFixed(0) + '%').join(' / '))
}

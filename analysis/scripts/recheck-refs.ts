// Re-verify "unresolved" refs in eval result files with the corrected checker (invalid vs. unknown).
//   npx tsx analysis/scripts/recheck-refs.ts evals/runs/<run>.jsonl [...]
import fs from 'fs'
import { checkRef, type RefStatus } from '@/lib/sefaria/verify'

async function main() {
  const cache = new Map<string, RefStatus>()
  for (const file of process.argv.slice(2)) {
    const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    let invalid = 0, unknown = 0, valid = 0
    const examples: string[] = []
    for (const r of rows) {
      for (const ref of (r.scores?.cited_refs_unresolved ?? []) as string[]) {
        if (!cache.has(ref)) { cache.set(ref, await checkRef(ref)); await new Promise((x) => setTimeout(x, 120)) }
        const s = cache.get(ref)!
        if (s === 'invalid') { invalid++; if (examples.length < 12) examples.push(ref) } else if (s === 'unknown') unknown++; else valid++
      }
    }
    console.log(`${file}: answers ${rows.length} · truly invalid ${invalid} (${(invalid / rows.length).toFixed(2)}/answer) · actually valid ${valid} · unknown ${unknown}`)
    console.log('  invalid examples:', examples.join(' | '))
  }
  process.exit(0)
}
main()

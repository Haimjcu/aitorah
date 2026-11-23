// Quick live check of the agent loop on a few questions.
//   scripts/dev-local.sh npx tsx analysis/scripts/agent-smoke.ts ["question" ...]
import Anthropic from '@anthropic-ai/sdk'
import { runAgent } from '@/lib/agent/run'
import { estimateCost } from '@/lib/ai/models'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const args = process.argv.slice(2)
const qs = args.length ? args : [
  'Is it permitted to open an umbrella on Shabbat?',
  'Que dit Rachi sur le premier verset de la Torah ?',
  'What parasha do we read this week?',
]

async function main() {
  for (const q of qs) {
    const r = await runAgent(client, {
      messages: [{ role: 'user', content: q }],
      noSkills: process.env.AGENT_EVAL_NO_SKILLS === '1',
      onEvent: (e) => { if (e.type === 'status') console.log('  ·', e.label) },
    })
    const cost = r.calls.reduce((s, c) => s + (estimateCost(c.model, c.usage) ?? 0), 0)
    const cache = r.calls.reduce((s, c) => s + (c.usage.cache_read_input_tokens ?? 0), 0)
    console.log(`Q: ${q}`)
    console.log(`  route=${r.route.domains.join('+')} lang=${r.route.language} tools=${r.toolCalls.length} stop=${r.stopReason} ttft=${r.ttftMs}ms total=${r.latencyMs}ms cost=$${cost.toFixed(3)} cacheRead=${cache}`)
    console.log(`  cited=${r.citations.cited.length} unverified=${JSON.stringify(r.citations.unverified)} sources=${r.sources.map((s) => s.ref).slice(0, 5).join(' | ')}`)
    console.log('  ' + r.answer.slice(0, 350).replace(/\n/g, ' ') + '\n')
  }
}

main().catch((e) => { console.error('ERR', e.status ?? '', e.message); process.exit(1) })

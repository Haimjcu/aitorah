// Nightly learning loop (run on a schedule, e.g. a Railway cron service):
//   scripts/dev-local.sh npx tsx scripts/learning-loop.ts [--dry-run] [--eval-limit 20]
import Anthropic from '@anthropic-ai/sdk'
import { runLearningLoop } from '@/lib/learning-loop'

const argv = process.argv.slice(2)
const evalLimit = Number(argv[argv.indexOf('--eval-limit') + 1]) || 20
runLearningLoop(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), { dryRun: argv.includes('--dry-run'), evalLimit })
  .then((o) => { console.log(JSON.stringify(o, null, 2)); process.exit(0) })
  .catch((e) => { console.error(e); process.exit(1) })

// Reference verification shared by the agent's citation check and the eval judge.
// Only an explicit Sefaria "no such ref" answer counts as invalid; network errors and rate limits are "unknown"
// (otherwise load spikes look like invented sources). Concurrency is capped to stay under Sefaria's limits.
import { getTexts } from './client'

export type RefStatus = 'valid' | 'invalid' | 'unknown'

const MAX_CONCURRENT = 4
let active = 0
const queue: (() => void)[] = []
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => queue.push(r))
  active++
  try { return await fn() } finally { active--; queue.shift()?.() }
}

export async function checkRef(ref: string): Promise<RefStatus> {
  return slot(async () => {
    try {
      const t = await getTexts(ref, { version: 'primary' })
      return (t as unknown as { error?: string }).error ? 'invalid' : 'valid'
    } catch (e) {
      // fetchSefaria throws "Sefaria API error: 404 ..." for unknown books; treat 4xx (except 429) as invalid
      const status = Number((e as Error).message.match(/error: (\d{3})/)?.[1])
      return status >= 400 && status < 500 && status !== 429 ? 'invalid' : 'unknown'
    }
  })
}

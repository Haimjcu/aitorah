import Anthropic from '@anthropic-ai/sdk'
import { classifyIntent } from '@/lib/rag/intent'
import { ANSWER_MODEL, routeParams } from '@/lib/ai/models'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
;(async () => {
  let t = Date.now()
  const intent = await classifyIntent('What does Rashi say about Genesis 1:1, and is it permitted to cook on Yom Tov?', client)
  console.log('INTENT', Date.now() - t, 'ms', JSON.stringify(intent))
  t = Date.now()
  const stream = client.messages.stream({ ...routeParams(ANSWER_MODEL), system: 'Answer in two sentences.', messages: [{ role: 'user', content: 'What is the first word of the Torah and what does it mean?' }] })
  let text = '', first = 0
  for await (const c of stream) if (c.type === 'content_block_delta' && c.delta.type === 'text_delta') { if (!first) first = Date.now() - t; text += c.delta.text }
  const m = await stream.finalMessage()
  console.log('ANSWER first-token', first, 'ms total', Date.now() - t, 'ms', m.model, m.stop_reason, JSON.stringify(m.usage))
  console.log(text)
})().catch(e => { console.error('ERR', e.status, e.message); process.exit(1) })

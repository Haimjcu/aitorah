// Feature flags / kill switches, read from env at request time.

/** When false (or unset), chat uses the legacy /api/chat pipeline. Set AGENT_ENABLED=false to roll back instantly. */
export function agentEnabled(): boolean {
  return process.env.AGENT_ENABLED === 'true'
}

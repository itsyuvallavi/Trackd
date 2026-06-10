export const STALE_RUNNING_BOT_RUN_MS = 10 * 60 * 1000

export function isStaleRunningBotRun(startedAt: Date, now = new Date()): boolean {
  return startedAt.getTime() < now.getTime() - STALE_RUNNING_BOT_RUN_MS
}

export function staleRunningBotRunErrors() {
  return {
    fatal: 'Job search exceeded the runtime budget and was marked failed.',
    stale: true,
  }
}

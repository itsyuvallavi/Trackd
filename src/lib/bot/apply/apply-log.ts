/**
 * Structured logs for auto-apply. Search runtime logs for `[bot/apply]`.
 */

export function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function logApply(phase: string, data: Record<string, unknown> = {}): void {
  console.log(
    '[bot/apply]',
    JSON.stringify({ phase, ts: new Date().toISOString(), ...data })
  )
}

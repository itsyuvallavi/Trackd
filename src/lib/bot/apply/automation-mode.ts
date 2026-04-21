/**
 * Optional "full automation" for personal / local testing only.
 * When enabled, the planner may click final submit and account-creation buttons,
 * and the DOM scan includes submit controls.
 *
 * Set BROWSER_APPLY_UNSAFE_FULL_AUTOMATION=1 — never enable on shared or production
 * multi-tenant hosts without understanding legal and account risk.
 */
export function isUnsafeFullAutomation(): boolean {
  return process.env.BROWSER_APPLY_UNSAFE_FULL_AUTOMATION?.trim() === '1'
}

/** Extra wait after each plan action (fill/click/select) so a human can follow along (0 = off). */
export function applyActionStepDelayMs(): number {
  const raw = process.env.BROWSER_APPLY_ACTION_DELAY_MS?.trim()
  if (!raw) return 0
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, 15_000)
}

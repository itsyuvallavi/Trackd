/**
 * IMAP `SINCE` and Gmail `after:` are **calendar-day** granular, not time-of-day.
 * If we search that day but then filter with `email.date >= lastSyncedAt` using an
 * exact timestamp from a *previous* sync the same day, every message from earlier
 * that day is incorrectly dropped.
 *
 * Align the lower bound to **local midnight** of the calendar day containing the
 * given instant so server queries and client-side filters agree.
 */
export function alignEmailSyncLowerBound(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

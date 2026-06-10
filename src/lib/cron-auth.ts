type CronAuthEnv = Partial<Pick<NodeJS.ProcessEnv, 'CRON_SECRET' | 'NODE_ENV'>>

/**
 * Authorize cron invocations via `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron sends that header automatically when `CRON_SECRET` is set on the project.
 * GitHub Actions and other schedulers must send the same bearer token explicitly.
 */
export function isCronRequestAuthorized(headers: Headers, env: CronAuthEnv = process.env): boolean {
  const cronSecret = env.CRON_SECRET?.trim()
  const authHeader = headers.get('authorization')

  if (env.NODE_ENV === 'production') {
    return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
  }

  if (!cronSecret) {
    return true
  }

  return authHeader === `Bearer ${cronSecret}`
}

import { requireAuth } from '@/lib/auth'
import { getBotRunsList } from '@/lib/cached-queries'
import { BotRunsPanel } from '@/components/bot/bot-runs-panel'
import { sanitizeJsonClone, serializeForClient } from '@/lib/serialize-for-client'

export const metadata = { title: 'Job Search activity — Trackd' }

export default async function BotRunsPage() {
  const user = await requireAuth()

  const recentRuns = await getBotRunsList(user.id)

  const recentRunsSafe = recentRuns.map((r) => ({
    ...r,
    errors: sanitizeJsonClone(r.errors),
  }))

  return (
    <section>
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">Activity</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search history with match counts, scoring sources, and skip reasons.
        </p>
      </header>
      <BotRunsPanel runs={serializeForClient(recentRunsSafe)} />
    </section>
  )
}

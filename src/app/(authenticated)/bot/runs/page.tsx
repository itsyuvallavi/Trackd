import { requireAuth } from '@/lib/auth'
import { getBotRunsList } from '@/lib/cached-queries'
import { BotRunsPanel } from '@/components/bot/bot-runs-panel'
import { sanitizeJsonClone, serializeForClient } from '@/lib/serialize-for-client'

export const metadata = { title: 'Job Search runs — Trackd' }

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
        <h2 className="text-xl font-semibold tracking-tight">Recent runs</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Latest searches with pipeline counts, scoring profile source, and AI skip reasoning.
        </p>
      </header>
      <BotRunsPanel runs={serializeForClient(recentRunsSafe)} />
    </section>
  )
}

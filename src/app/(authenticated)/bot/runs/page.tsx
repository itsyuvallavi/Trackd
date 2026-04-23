import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BotRunsPanel } from '@/components/bot/bot-runs-panel'
import { sanitizeJsonClone, serializeForClient } from '@/lib/serialize-for-client'

export const metadata = { title: 'Job Search runs — Trackd' }

export default async function BotRunsPage() {
  const user = await requireAuth()

  const recentRuns = await prisma.botRun.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: 'desc' },
    take: 25,
    select: {
      id: true,
      status: true,
      source: true,
      jobsFound: true,
      jobsNew: true,
      jobsApproved: true,
      startedAt: true,
      completedAt: true,
      duration: true,
      errors: true,
    },
  })

  const recentRunsSafe = recentRuns.map((r) => ({
    ...r,
    errors: sanitizeJsonClone(r.errors),
  }))

  return (
    <section>
      <header className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">Recent runs</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Latest searches with pipeline counts and AI skip reasoning.
        </p>
      </header>
      <BotRunsPanel runs={serializeForClient(recentRunsSafe)} />
    </section>
  )
}

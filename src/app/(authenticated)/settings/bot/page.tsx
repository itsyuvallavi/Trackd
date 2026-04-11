import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppShell } from '@/components/layout/app-shell'
import { BotSettingsContent } from '@/components/bot/bot-settings-content'

export default async function BotSettingsPage() {
  const user = await requireAuth()

  const [botConfig, recentRuns] = await Promise.all([
    prisma.botConfig.findUnique({ where: { userId: user.id } }),
    prisma.botRun.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 5,
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
    }),
  ])

  const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN
  const searchServiceConfigured = !!(process.env.JSEARCH_API_KEY || process.env.SERP_API_KEY)

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-1">Job Search Bot</h1>
            <p className="text-sm text-muted-foreground">
              Automatically search for jobs that match your profile and get notified when new
              opportunities appear.
            </p>
          </div>
          <BotSettingsContent
            initialConfig={botConfig}
            recentRuns={recentRuns}
            telegramConfigured={telegramConfigured}
            searchServiceConfigured={searchServiceConfigured}
          />
        </div>
      </div>
    </AppShell>
  )
}

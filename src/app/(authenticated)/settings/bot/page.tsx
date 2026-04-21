import type { ComponentProps } from 'react'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppShell } from '@/components/layout/app-shell'
import { BotSettingsContent } from '@/components/bot/bot-settings-content'
import { BotResumeManager } from '@/components/bot/bot-resume-manager'
import { sanitizeJsonClone, serializeForClient } from '@/lib/serialize-for-client'
import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_RESULTS_WANTED,
  describeJSearchDateWindow,
} from '@/lib/bot/search-constants'
import { jobsSearchApiRapidApiKey } from '@/lib/bot/rapidapi-jobs-search-keys'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'

/** Allow long-running bot search from "Run now" (same ceiling as /api/cron/bot-search). */
export const maxDuration = 300

type BotResumeManagerResumes = ComponentProps<typeof BotResumeManager>['initialResumes']

export default async function BotSettingsPage() {
  const user = await requireAuth()

  const [botConfig, recentRuns, resumes] = await Promise.all([
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
    prisma.botResume.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        label: true,
        matchKeywords: true,
        isDefault: true,
        fileName: true,
        fileUrl: true,
        structuredData: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN
  const searchServiceConfigured = botSearchHasQueryableBackend()

  const recentRunsSafe = recentRuns.map((r) => ({
    ...r,
    errors: sanitizeJsonClone(r.errors),
  }))
  const resumesSafe = resumes.map((r) => ({
    ...r,
    structuredData: sanitizeJsonClone(r.structuredData),
  }))

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
            initialConfig={serializeForClient(botConfig)}
            recentRuns={serializeForClient(recentRunsSafe)}
            telegramConfigured={telegramConfigured}
            searchServiceConfigured={searchServiceConfigured}
            searchBackends={{
              jsearch: !!process.env.JSEARCH_API_KEY,
              jobsSearchApi: jobsSearchApiRapidApiKey().length > 0,
            }}
            searchUiCaps={{
              keywordOrMax: BOT_SEARCH_KEYWORD_OR_MAX,
              locationPassesMax: BOT_SEARCH_LOCATION_PASSES_MAX,
              resultsTarget: BOT_SEARCH_RESULTS_WANTED,
              jsearchDateLabel: describeJSearchDateWindow(),
            }}
          />
          <BotResumeManager
            initialResumes={
              serializeForClient(resumesSafe).map((r) => ({
                ...r,
                structuredData: r.structuredData as import('@/lib/bot/resume/types').ResumeStructuredData | null,
              })) as unknown as BotResumeManagerResumes
            }
          />
        </div>
      </div>
    </AppShell>
  )
}

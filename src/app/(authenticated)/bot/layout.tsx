import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { getBotConfigByUserId, getBotLastRunForStrip } from '@/lib/cached-queries'
import { BotStatusStrip } from '@/components/bot/bot-status-strip'
import { BotTabs } from '@/components/bot/bot-tabs'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import { prisma } from '@/lib/prisma'
import type { BotSearchFrequency } from '@prisma/client'

/** Allow long-running bot search from "Run now" in the status strip. */
export const maxDuration = 300

const FREQUENCY_LABELS: Record<BotSearchFrequency, string> = {
  DAILY: 'Once daily (8AM UTC)',
  TWICE_DAILY: 'Twice daily (8AM + 8PM UTC)',
  WEEKLY: 'Weekly (Mondays 8AM UTC)',
}

/** `unstable_cache` round-trips through JSON; `Date` becomes an ISO string. */
function toIsoString(value: Date | string): string {
  if (typeof value === 'string') return value
  return value.toISOString()
}

export default async function BotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  const [botConfig, lastRun, botResumes, appProfile] = await Promise.all([
    getBotConfigByUserId(user.id),
    getBotLastRunForStrip(user.id),
    prisma.botResume.findMany({
      where: { userId: user.id },
      select: { structuredData: true },
    }),
    prisma.applicationProfile.findUnique({
      where: { userId: user.id },
      select: {
        applicationFullName: true,
        applicationEmail: true,
        city: true,
        country: true,
        workAuthorization: true,
        yearsExperience: true,
      },
    }),
  ])

  const searchServiceConfigured = botSearchHasQueryableBackend()
  const hasKeywords = (botConfig?.keywords?.length ?? 0) > 0
  const canRun = searchServiceConfigured && hasKeywords
  const parsedResumeCount = botResumes.filter((r) => r.structuredData != null).length
  const hasIdentityFallback = Boolean(
    appProfile &&
      (appProfile.applicationFullName?.trim() ||
        appProfile.applicationEmail?.trim() ||
        appProfile.city?.trim() ||
        appProfile.country?.trim() ||
        appProfile.workAuthorization?.trim() ||
        appProfile.yearsExperience != null)
  )
  const runDisabledReason = !searchServiceConfigured
    ? 'No search backend configured.'
    : !hasKeywords
      ? 'Add at least one keyword in Settings to enable searches.'
      : undefined

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-6 md:py-8">
          <header className="mb-6">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="relative inline-flex size-2 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-primary/40 trackd-breath" />
                <span className="relative size-2 rounded-full bg-primary" />
              </span>
              <h1 className="text-3xl font-semibold tracking-tight">Job Search</h1>
            </div>
            <div className="glass glass-subtle rounded-2xl px-4 md:px-5 py-3">
              <BotStatusStrip
                isActive={botConfig?.isActive ?? false}
                frequencyLabel={
                  FREQUENCY_LABELS[botConfig?.searchFrequency ?? 'DAILY']
                }
                lastRun={
                  lastRun
                    ? {
                        startedAt: toIsoString(lastRun.startedAt),
                        jobsFound: lastRun.jobsFound,
                        jobsNew: lastRun.jobsNew,
                        jobsApproved: lastRun.jobsApproved,
                      }
                    : null
                }
                canRun={canRun}
                runDisabledReason={runDisabledReason}
                resumeReadiness={{
                  totalCount: botResumes.length,
                  parsedCount: parsedResumeCount,
                  hasIdentityFallback,
                }}
              />
            </div>
          </header>

          <div className="mb-5 border-b border-border/60 pb-2">
            <BotTabs />
          </div>

          {children}
        </div>
      </div>
    </AppShell>
  )
}

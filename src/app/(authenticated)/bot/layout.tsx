import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { getBotConfigByUserId, getBotLastRunForStrip } from '@/lib/cached-queries'
import { BotStatusStrip } from '@/components/bot/bot-status-strip'
import { BotTabs } from '@/components/bot/bot-tabs'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import { resolveResumeReadinessSource } from '@/lib/bot/profile-source-labels'
import { prisma } from '@/lib/prisma'
import { Prisma, type BotSearchFrequency } from '@prisma/client'

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

async function getResumeReadinessCounts(userId: string): Promise<{
  totalCount: number
  parsedCount: number
  rawTextCount: number
}> {
  const [totalCount, parsedCount, rawTextRows] = await Promise.all([
    prisma.botResume.count({ where: { userId } }),
    prisma.botResume.count({
      where: {
        userId,
        NOT: [
          { structuredData: { equals: Prisma.DbNull } },
          { structuredData: { equals: Prisma.JsonNull } },
        ],
      },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM "BotResume"
      WHERE "userId" = ${userId}
        AND "rawText" IS NOT NULL
        AND btrim("rawText") <> ''
    `,
  ])

  return {
    totalCount,
    parsedCount,
    rawTextCount: Number(rawTextRows[0]?.count ?? 0),
  }
}

export default async function BotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  const [botConfig, lastRun, resumeReadinessCounts, appProfile] = await Promise.all([
    getBotConfigByUserId(user.id),
    getBotLastRunForStrip(user.id),
    getResumeReadinessCounts(user.id),
    prisma.applicationProfile.findUnique({
      where: { userId: user.id },
      select: {
        applicationFullName: true,
        applicationEmail: true,
        phone: true,
        city: true,
        state: true,
        country: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        workAuthorization: true,
        salaryExpectation: true,
        noticePeriod: true,
        yearsExperience: true,
        requiresSponsorship: true,
      },
    }),
  ])

  const searchServiceConfigured = botSearchHasQueryableBackend()
  const hasKeywords = (botConfig?.keywords?.length ?? 0) > 0
  const canRun = searchServiceConfigured && hasKeywords
  const hasIdentityFallback = Boolean(
    appProfile &&
      (appProfile.applicationFullName?.trim() ||
        appProfile.applicationEmail?.trim() ||
        appProfile.phone?.trim() ||
        appProfile.city?.trim() ||
        appProfile.state?.trim() ||
        appProfile.country?.trim() ||
        appProfile.linkedinUrl?.trim() ||
        appProfile.githubUrl?.trim() ||
        appProfile.portfolioUrl?.trim() ||
        appProfile.workAuthorization?.trim() ||
        appProfile.salaryExpectation != null ||
        appProfile.noticePeriod?.trim() ||
        appProfile.yearsExperience != null ||
        appProfile.requiresSponsorship)
  )
  const resumeReadinessSource = resolveResumeReadinessSource({
    totalCount: resumeReadinessCounts.totalCount,
    parsedCount: resumeReadinessCounts.parsedCount,
    rawTextCount: resumeReadinessCounts.rawTextCount,
    hasIdentityFallback,
  })
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
                  totalCount: resumeReadinessCounts.totalCount,
                  source: resumeReadinessSource,
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

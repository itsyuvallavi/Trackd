import { unstable_cache } from 'next/cache'
import { JobStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPublicJobTableColumnNames } from '@/lib/prisma-job-columns'
import { cacheTagsFor } from '@/lib/cache-tags'
import {
  profileSourceLabel,
  type CandidateProfileSourceKind,
} from '@/lib/bot/profile-source-labels'

/**
 * Hot-path queries cached with `unstable_cache` (the Next 16 path for caching
 * without Cache Components). Results survive across requests and are surgically
 * invalidated via `revalidateTag(tag, { expire: 0 })` from server actions.
 *
 * Invalidation uses per-user tags (see `cache-tags.ts`) so one user's mutation
 * never purges another user's hot data.
 */

const ONE_MINUTE = 60

const PROFILE_SOURCE_KINDS = [
  'parsed_resume',
  'raw_resume_fallback',
  'application_identity_fallback',
  'settings_fallback',
  'none',
] as const satisfies readonly CandidateProfileSourceKind[]

export type BotRunProfileSourceSummary = {
  kind: CandidateProfileSourceKind
  label: string
  resumeLabel: string | null
  listings: number
  applicationIdentitySupplemented: boolean
  settingsDerivedSignalsUsed: boolean
  limitations: string[]
}

type ProfileSourceMetadata = Omit<BotRunProfileSourceSummary, 'listings'>

function recordFromJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringArrayFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function isProfileSourceKind(value: unknown): value is CandidateProfileSourceKind {
  return typeof value === 'string' && PROFILE_SOURCE_KINDS.includes(value as CandidateProfileSourceKind)
}

function legacyProfileSourceKind(
  value: unknown,
  resumeUsed: Record<string, unknown> | null
): CandidateProfileSourceKind | null {
  if (isProfileSourceKind(value)) return value
  if (typeof value !== 'string') return null

  switch (value) {
    case 'matched_by_keywords':
    case 'matched_default':
    case 'uploaded_resume':
      return resumeUsed?.resumeId || resumeUsed?.label ? 'parsed_resume' : null
    case 'raw_text':
    case 'raw_resume':
      return 'raw_resume_fallback'
    case 'identity_fallback':
    case 'application_identity':
      return 'application_identity_fallback'
    case 'settings':
    case 'settings_only':
      return 'settings_fallback'
    case 'none':
      return 'none'
    default:
      return null
  }
}

export function profileSourceFromScoringInputs(
  scoringInputs: Prisma.JsonValue | null
): ProfileSourceMetadata | null {
  const root = recordFromJson(scoringInputs)
  if (!root) return null

  const profileSource = recordFromJson(root.profileSource)
  const resumeUsed = recordFromJson(root.resumeUsed)
  const rawKind = profileSource?.kind ?? resumeUsed?.sourceKind ?? resumeUsed?.selection
  const kindValue = legacyProfileSourceKind(rawKind, resumeUsed)

  if (!kindValue) return null

  const label =
    typeof profileSource?.label === 'string'
      ? profileSource.label
      : typeof resumeUsed?.sourceLabel === 'string'
        ? resumeUsed.sourceLabel
        : profileSourceLabel(kindValue)

  const legacyLimitations =
    profileSource || isProfileSourceKind(rawKind)
      ? []
      : ['Legacy run metadata did not include full profile-source diagnostics.']

  const resumeLabel =
    typeof profileSource?.resumeLabel === 'string'
      ? profileSource.resumeLabel
      : typeof resumeUsed?.label === 'string'
        ? resumeUsed.label
        : null

  return {
    kind: kindValue,
    label,
    resumeLabel,
    applicationIdentitySupplemented:
      profileSource?.applicationIdentitySupplemented === true ||
      resumeUsed?.applicationIdentitySupplemented === true,
    settingsDerivedSignalsUsed:
      profileSource?.settingsDerivedSignalsUsed === true ||
      resumeUsed?.settingsDerivedSignalsUsed === true,
    limitations: [
      ...stringArrayFromJson(profileSource?.limitations ?? resumeUsed?.limitations),
      ...legacyLimitations,
    ],
  }
}

export function summarizeProfileSources(
  rows: { scoringInputs: Prisma.JsonValue | null }[]
): BotRunProfileSourceSummary[] {
  const bySource = new Map<string, BotRunProfileSourceSummary>()

  for (const row of rows) {
    const source = profileSourceFromScoringInputs(row.scoringInputs)
    if (!source) continue

    const key = [
      source.kind,
      source.label,
      source.resumeLabel ?? '',
      String(source.applicationIdentitySupplemented),
      String(source.settingsDerivedSignalsUsed),
    ].join(':')
    const existing = bySource.get(key)
    if (existing) {
      existing.listings += 1
      for (const limitation of source.limitations) {
        if (!existing.limitations.includes(limitation)) {
          existing.limitations.push(limitation)
        }
      }
      continue
    }

    bySource.set(key, {
      ...source,
      listings: 1,
      limitations: [...source.limitations],
    })
  }

  return [...bySource.values()].sort((a, b) => b.listings - a.listings)
}

type CompactProfileSourceRow = {
  botRunId: string
  profileSource: Prisma.JsonValue | null
  resumeUsed: Prisma.JsonValue | null
}

function compactProfileSourceScoringInput(row: CompactProfileSourceRow): Prisma.JsonValue {
  return {
    profileSource: row.profileSource,
    resumeUsed: row.resumeUsed,
  }
}

async function getCompactProfileSourceRows(botRunIds: string[]): Promise<CompactProfileSourceRow[]> {
  if (botRunIds.length === 0) return []

  return prisma.$queryRaw<CompactProfileSourceRow[]>`
    SELECT
      "botRunId",
      jsonb_strip_nulls(jsonb_build_object(
        'kind', "scoringInputs" #> '{profileSource,kind}',
        'label', "scoringInputs" #> '{profileSource,label}',
        'resumeLabel', "scoringInputs" #> '{profileSource,resumeLabel}',
        'applicationIdentitySupplemented', "scoringInputs" #> '{profileSource,applicationIdentitySupplemented}',
        'settingsDerivedSignalsUsed', "scoringInputs" #> '{profileSource,settingsDerivedSignalsUsed}',
        'limitations', "scoringInputs" #> '{profileSource,limitations}'
      )) AS "profileSource",
      jsonb_strip_nulls(jsonb_build_object(
        'sourceKind', "scoringInputs" #> '{resumeUsed,sourceKind}',
        'selection', "scoringInputs" #> '{resumeUsed,selection}',
        'sourceLabel', "scoringInputs" #> '{resumeUsed,sourceLabel}',
        'label', "scoringInputs" #> '{resumeUsed,label}',
        'applicationIdentitySupplemented', "scoringInputs" #> '{resumeUsed,applicationIdentitySupplemented}',
        'settingsDerivedSignalsUsed', "scoringInputs" #> '{resumeUsed,settingsDerivedSignalsUsed}',
        'limitations', "scoringInputs" #> '{resumeUsed,limitations}',
        'resumeId', "scoringInputs" #> '{resumeUsed,resumeId}'
      )) AS "resumeUsed"
    FROM "BotRunListing"
    WHERE "botRunId" IN (${Prisma.join(botRunIds)})
      AND "scoringInputs" IS NOT NULL
      AND ("scoringInputs" ? 'profileSource' OR "scoringInputs" ? 'resumeUsed')
    ORDER BY "botRunId" ASC, "sequence" ASC
  `
}

function summarizeProfileSourcesByRun(rows: CompactProfileSourceRow[]) {
  const rowsByRun = new Map<string, { scoringInputs: Prisma.JsonValue | null }[]>()

  for (const row of rows) {
    const runRows = rowsByRun.get(row.botRunId) ?? []
    runRows.push({ scoringInputs: compactProfileSourceScoringInput(row) })
    rowsByRun.set(row.botRunId, runRows)
  }

  return rowsByRun
}

/**
 * Cached query for email integration.
 * Fetched on almost every authenticated page and changes rarely, so a long
 * revalidate window is safe — mutations invalidate the tag explicitly.
 */
export const getEmailIntegration = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.emailIntegration.findUnique({
        where: { userId },
      }),
    ['getEmailIntegration', userId],
    {
      tags: [cacheTagsFor(userId).email],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Cached user profile. */
export const getUserProfile = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.profile.findUnique({
        where: { id: userId },
      }),
    ['getUserProfile', userId],
    {
      tags: [cacheTagsFor(userId).profile],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Cached extension key. */
export const getExtensionKey = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.extensionKey.findUnique({
        where: { userId },
        select: {
          keyPrefix: true,
          lastUsedAt: true,
        },
      }),
    ['getExtensionKey', userId],
    {
      tags: [`user:${userId}:extensionKey`],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Cached unread notification count — used by the notification bell. */
export const getUnreadNotificationCount = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ['getUnreadNotificationCount', userId],
    {
      tags: [cacheTagsFor(userId).notifications],
      revalidate: ONE_MINUTE,
    },
  )()

/** Cached recent notifications. */
export const getRecentNotifications = (userId: string, limit = 50) =>
  unstable_cache(
    async () =>
      prisma.notification.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          metadata: true,
          isRead: true,
          actionUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ['getRecentNotifications', userId, String(limit)],
    {
      tags: [cacheTagsFor(userId).notifications],
      revalidate: ONE_MINUTE,
    },
  )()

/** Cached recent activities. */
export const getRecentActivities = (userId: string, limit = 50) =>
  unstable_cache(
    async () =>
      prisma.activity.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          description: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              company: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ['getRecentActivities', userId, String(limit)],
    {
      tags: [cacheTagsFor(userId).activity],
      revalidate: ONE_MINUTE,
    },
  )()

/**
 * Cached user jobs list. Most-accessed query — caching across requests is the
 * biggest single TTFB win in this module.
 */
export const getUserJobs = async (userId: string, limit = 100) => {
  // Column introspection result is memoized for the lifetime of the process,
  // so this is cheap and we want to perform it OUTSIDE the cached closure to
  // keep the cache key stable across cold/warm starts.
  const cols = await getPublicJobTableColumnNames()
  const hasImportSource = cols.has('importSource')
  const hasImportJobBoard = cols.has('importJobBoard')

  const baseSelect = {
    id: true,
    title: true,
    company: true,
    location: true,
    status: true,
    priority: true,
    source: true,
    tags: true,
    url: true,
    savedAt: true,
    appliedAt: true,
    interviewAt: true,
    nextAction: true,
    notes: true,
    salary: true,
    contactName: true,
    contactEmail: true,
    createdAt: true,
    updatedAt: true,
  } as const

  const select = {
    ...baseSelect,
    ...(hasImportSource ? { importSource: true as const } : {}),
    ...(hasImportJobBoard ? { importJobBoard: true as const } : {}),
  }

  return unstable_cache(
    async () => {
      const rows = await prisma.job.findMany({
        where: { userId },
        select,
        orderBy: { savedAt: 'desc' },
        take: limit,
      })

      return rows.map((r) => ({
        ...r,
        importSource: hasImportSource
          ? ((r as { importSource?: string | null }).importSource ?? null)
          : null,
        importJobBoard: hasImportJobBoard
          ? ((r as { importJobBoard?: string | null }).importJobBoard ?? null)
          : null,
      }))
    },
    [
      'getUserJobs',
      userId,
      String(limit),
      String(hasImportSource),
      String(hasImportJobBoard),
    ],
    {
      tags: [cacheTagsFor(userId).jobs],
      revalidate: ONE_MINUTE,
    },
  )()
}

/**
 * Slim projection for the /jobs table. Keep getUserJobs broader for /board and
 * future full-row consumers; this page only needs list/filter fields.
 */
export const getUserJobsListRows = async (userId: string, limit = 100) => {
  const cols = await getPublicJobTableColumnNames()
  const hasImportSource = cols.has('importSource')
  const hasImportJobBoard = cols.has('importJobBoard')

  const select = {
    id: true,
    title: true,
    company: true,
    location: true,
    status: true,
    source: true,
    tags: true,
    notes: true,
    createdAt: true,
    ...(hasImportSource ? { importSource: true as const } : {}),
    ...(hasImportJobBoard ? { importJobBoard: true as const } : {}),
  }

  return unstable_cache(
    async () => {
      const rows = await prisma.job.findMany({
        where: { userId },
        select,
        orderBy: { savedAt: 'desc' },
        take: limit,
      })

      return rows.map((r) => ({
        ...r,
        importSource: hasImportSource
          ? ((r as { importSource?: string | null }).importSource ?? null)
          : null,
        importJobBoard: hasImportJobBoard
          ? ((r as { importJobBoard?: string | null }).importJobBoard ?? null)
          : null,
      }))
    },
    [
      'getUserJobsListRows',
      userId,
      String(limit),
      String(hasImportSource),
      String(hasImportJobBoard),
    ],
    {
      tags: [cacheTagsFor(userId).jobs],
      revalidate: ONE_MINUTE,
    },
  )()
}

/** Group-by status counts (dashboard, today header). */
export const getUserStatusCounts = (userId: string) =>
  unstable_cache(
    async () => {
      const rows = await prisma.job.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      })
      const statusCountsMap: Record<JobStatus, number> = {
        SAVED: 0,
        APPLIED: 0,
        INTERVIEW: 0,
        OFFER: 0,
        REJECTED: 0,
        ARCHIVED: 0,
      }
      for (const item of rows) {
        statusCountsMap[item.status as JobStatus] = item._count
      }
      return statusCountsMap
    },
    ['getUserStatusCounts', userId],
    {
      tags: [cacheTagsFor(userId).jobs],
      revalidate: ONE_MINUTE,
    },
  )()

export type TodayTimeOfDay = 'morning' | 'afternoon' | 'evening'

export interface TodayBucketRow {
  job: {
    id: string
    title: string
    company: string
    status: JobStatus
    savedAt: string
    interviewAt: string | null
    nextAction: string | null
    appliedAt: string | null
  }
  reason: string
  timeOfDay: TodayTimeOfDay
}

/**
 * Today page model: keyed by calendar day (UTC) so cache rolls over at midnight
 * and stays aligned with the “what needs attention today” logic.
 */
export const getTodayPageData = (userId: string) => {
  const dateKey = new Date().toISOString().slice(0, 10)
  return unstable_cache(
    async () => {
      const today = new Date()
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      const [statusCounts, activeJobs] = await Promise.all([
        prisma.job.groupBy({
          by: ['status'],
          where: { userId },
          _count: true,
        }),
        prisma.job.findMany({
          where: {
            userId,
            status: { in: ['SAVED', 'APPLIED', 'INTERVIEW'] },
          },
          select: {
            id: true,
            title: true,
            company: true,
            status: true,
            savedAt: true,
            interviewAt: true,
            nextAction: true,
            appliedAt: true,
          },
          orderBy: { savedAt: 'desc' },
          take: 500,
        }),
      ])

      const statusCountsMap: Record<JobStatus, number> = {
        SAVED: 0,
        APPLIED: 0,
        INTERVIEW: 0,
        OFFER: 0,
        REJECTED: 0,
        ARCHIVED: 0,
      }
      statusCounts.forEach((item) => {
        statusCountsMap[item.status as JobStatus] = item._count
      })

      const bucketForDate = (d: Date): TodayTimeOfDay => {
        const h = d.getHours()
        if (h < 12) return 'morning'
        if (h < 18) return 'afternoon'
        return 'evening'
      }

      const items: TodayBucketRow[] = []

      for (const job of activeJobs) {
        const daysSinceSaved = Math.floor(
          (today.getTime() - job.savedAt.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (
          job.status === 'INTERVIEW' &&
          job.interviewAt &&
          new Date(job.interviewAt).toDateString() === today.toDateString()
        ) {
          const when = new Date(job.interviewAt)
          items.push({
            job: {
              id: job.id,
              title: job.title,
              company: job.company,
              status: job.status,
              savedAt: job.savedAt.toISOString(),
              interviewAt: job.interviewAt ? job.interviewAt.toISOString() : null,
              nextAction: job.nextAction,
              appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
            },
            reason: `Interview at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
            timeOfDay: bucketForDate(when),
          })
          continue
        }

        if (job.status === 'SAVED' && daysSinceSaved > 7) {
          items.push({
            job: {
              id: job.id,
              title: job.title,
              company: job.company,
              status: job.status,
              savedAt: job.savedAt.toISOString(),
              interviewAt: job.interviewAt ? job.interviewAt.toISOString() : null,
              nextAction: job.nextAction,
              appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
            },
            reason: `Saved ${daysSinceSaved} days ago — follow up`,
            timeOfDay: 'morning',
          })
          continue
        }

        if (job.status === 'SAVED' && daysSinceSaved >= 3 && daysSinceSaved <= 7) {
          items.push({
            job: {
              id: job.id,
              title: job.title,
              company: job.company,
              status: job.status,
              savedAt: job.savedAt.toISOString(),
              interviewAt: job.interviewAt ? job.interviewAt.toISOString() : null,
              nextAction: job.nextAction,
              appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
            },
            reason: `Saved ${daysSinceSaved} days ago`,
            timeOfDay: 'afternoon',
          })
          continue
        }

        if (
          job.status === 'APPLIED' &&
          job.appliedAt &&
          new Date(job.appliedAt) >= sevenDaysAgo
        ) {
          items.push({
            job: {
              id: job.id,
              title: job.title,
              company: job.company,
              status: job.status,
              savedAt: job.savedAt.toISOString(),
              interviewAt: job.interviewAt ? job.interviewAt.toISOString() : null,
              nextAction: job.nextAction,
              appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
            },
            reason: `Applied recently — check inbox`,
            timeOfDay: 'evening',
          })
          continue
        }

        if (job.nextAction) {
          items.push({
            job: {
              id: job.id,
              title: job.title,
              company: job.company,
              status: job.status,
              savedAt: job.savedAt.toISOString(),
              interviewAt: job.interviewAt ? job.interviewAt.toISOString() : null,
              nextAction: job.nextAction,
              appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
            },
            reason: job.nextAction,
            timeOfDay: 'afternoon',
          })
        }
      }

      const byBucket: Record<TodayTimeOfDay, TodayBucketRow[]> = {
        morning: [],
        afternoon: [],
        evening: [],
      }
      for (const item of items) {
        byBucket[item.timeOfDay].push(item)
      }

      return {
        statusCountsMap,
        byBucket,
        totalNeedingAttention: items.length,
      }
    },
    ['getTodayPageData', userId, dateKey],
    {
      tags: [cacheTagsFor(userId).jobs],
      revalidate: 60 * 2,
    },
  )()
}

/** Full bot config row — shared by bot layout + /bot/settings. */
export const getBotConfigByUserId = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.botConfig.findUnique({
        where: { userId },
      }),
    ['getBotConfig', userId],
    {
      tags: [cacheTagsFor(userId).bot],
      revalidate: 5 * ONE_MINUTE,
    },
  )()

/** Last run shown in the bot status strip. */
export const getBotLastRunForStrip = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.botRun.findFirst({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: {
          startedAt: true,
          jobsFound: true,
          jobsNew: true,
          jobsApproved: true,
        },
      }),
    ['getBotLastRun', userId],
    {
      tags: [cacheTagsFor(userId).bot],
      revalidate: ONE_MINUTE,
    },
  )()

export const getBotResumesList = (userId: string) =>
  unstable_cache(
    async () =>
      prisma.botResume.findMany({
        where: { userId },
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
    ['getBotResumes', userId],
    {
      tags: [cacheTagsFor(userId).bot],
      revalidate: ONE_MINUTE,
    },
  )()

export const getBotRunsList = (userId: string) =>
  unstable_cache(
    async () => {
      const runs = await prisma.botRun.findMany({
        where: { userId },
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

      const profileSourceRows = await getCompactProfileSourceRows(runs.map((run) => run.id))
      const profileSourcesByRun = summarizeProfileSourcesByRun(profileSourceRows)

      return runs.map((run) => ({
        ...run,
        profileSources: summarizeProfileSources(profileSourcesByRun.get(run.id) ?? []),
      }))
    },
    ['getBotRuns', userId],
    {
      tags: [cacheTagsFor(userId).bot],
      revalidate: ONE_MINUTE,
    },
  )()

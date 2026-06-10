import { requireAuth } from '@/lib/auth'
import { Suspense } from 'react'
import {
  getBotConfigByUserId,
  getBotResumesList,
} from '@/lib/cached-queries'
import { serializeForClient, sanitizeJsonClone } from '@/lib/serialize-for-client'
import { BotSetupContent } from '@/components/bot/bot-setup-content'
import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_PROVIDER_PASSES_MAX,
  BOT_SEARCH_RESULTS_WANTED,
} from '@/lib/bot/search-constants'
import {
  botSearchHasQueryableBackend,
  effectiveSearchBackends,
} from '@/lib/bot/bot-search-sources'
import { loadCandidateProfileForEvaluation } from '@/lib/bot/candidate-profile'
import {
  buildSafeSearchProfile,
  deriveSafeResumeSearchTerms,
} from '@/lib/bot/search-profile'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { buildSetupReadiness } from '@/lib/bot/setup-readiness'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

export const metadata = { title: 'Job Search setup — Trackd' }

async function getResumeReadinessCounts(userId: string) {
  const [totalCount, parsedCount] = await Promise.all([
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
  ])
  return { totalCount, parsedCount }
}

export default async function BotSetupPage() {
  const user = await requireAuth()

  const [botConfig, resumes, appProfile, resumeCounts] = await Promise.all([
    getBotConfigByUserId(user.id),
    getBotResumesList(user.id),
    prisma.applicationProfile.findUnique({ where: { userId: user.id } }),
    getResumeReadinessCounts(user.id),
  ])

  const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN
  const searchServiceConfigured = botSearchHasQueryableBackend()
  const searchBackends = effectiveSearchBackends()

  const candidateProfile = botConfig
    ? await loadCandidateProfileForEvaluation(
        user.id,
        botConfig.keywords[0] ?? 'Job Search',
        botConfig
      )
    : null

  const safeSearchProfile = botConfig
    ? buildSafeSearchProfile({ config: botConfig, candidateProfile })
    : null

  const allResumeSearchTerms = deriveSafeResumeSearchTerms(candidateProfile)

  const appProfileForClient = appProfile
    ? (() => {
        const { portalSignupPassword: _omit, ...rest } = appProfile
        return {
          ...rest,
          hasPortalSignupPassword: Boolean(_omit),
        }
      })()
    : null

  const resumesSafe = resumes.map((r) => ({
    ...r,
    structuredData: sanitizeJsonClone(r.structuredData),
  }))

  const setupReadiness = buildSetupReadiness({
    resumeCount: resumeCounts.totalCount,
    parsedResumeCount: resumeCounts.parsedCount,
    applicationProfile: appProfile,
    keywordCount: botConfig?.keywords?.length ?? 0,
    searchableTermCount: safeSearchProfile?.terms.length ?? 0,
  })

  return (
    <section>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading setup…</p>}>
        <BotSetupContent
          initialConfig={serializeForClient(botConfig)}
          applicationProfile={serializeForClient(appProfileForClient)}
          initialResumes={serializeForClient(resumesSafe).map((r) => ({
            id: r.id,
            label: r.label,
            matchKeywords: r.matchKeywords,
            isDefault: r.isDefault,
            fileName: r.fileName,
            fileUrl: r.fileUrl,
            structuredData: r.structuredData as ResumeStructuredData | null,
            createdAt:
              typeof r.createdAt === 'string'
                ? r.createdAt
                : new Date(r.createdAt as Date).toISOString(),
          }))}
          setupReadiness={setupReadiness}
          telegramConfigured={telegramConfigured}
          searchServiceConfigured={searchServiceConfigured}
          searchBackends={searchBackends}
          safeResumeSearchTerms={safeSearchProfile?.terms ?? []}
          allResumeSearchTerms={allResumeSearchTerms}
          searchUiCaps={{
            keywordOrMax: BOT_SEARCH_KEYWORD_OR_MAX,
            locationPassesMax: BOT_SEARCH_LOCATION_PASSES_MAX,
            providerPassesMax: BOT_SEARCH_PROVIDER_PASSES_MAX,
            resultsTarget: BOT_SEARCH_RESULTS_WANTED,
          }}
        />
      </Suspense>
    </section>
  )
}

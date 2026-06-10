'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { cacheTagsFor } from '@/lib/cache-tags'
import { requireAuth } from '@/lib/auth'
import { verifyTelegramChatId } from '@/lib/bot/telegram'
import { executeBotRunForConfig } from '@/lib/bot/execute-bot-run'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import { revalidateBotRunViews } from '@/lib/bot/revalidate-bot-run-views'
import { BotSearchFrequency } from '@prisma/client'
import { sanitizeBotConfigFormData } from '@/lib/bot/bot-config-sanitize'
import {
  BOT_SEARCH_TERMS_REQUIRED_MSG,
  hasSearchableTerms,
} from '@/lib/bot/bot-search-readiness'
import { loadCandidateProfileForEvaluation } from '@/lib/bot/candidate-profile'

export interface BotConfigFormData {
  keywords: string[]
  locations: string[]
  excludeCompanies: string[]
  excludeKeywords: string[]
  /** Languages you speak fluently (e.g. english, hebrew). Used to filter jobs that mandate other languages. */
  spokenLanguages: string[]
  remoteOnly: boolean
  experienceLevel: string
  salaryMin: number | null
  isActive: boolean
  searchFrequency: BotSearchFrequency
  telegramChatId: string
  minScore: number
}

export async function saveBotConfig(
  data: BotConfigFormData,
  options?: { setupLayout?: boolean }
) {
  const user = await requireAuth()

  const sanitized = sanitizeBotConfigFormData(data, options)
  const resolvedChatId = sanitized.telegramChatId || null

  const cleaned = {
    keywords: sanitized.keywords,
    locations: sanitized.locations,
    excludeCompanies: sanitized.excludeCompanies,
    excludeKeywords: sanitized.excludeKeywords,
    spokenLanguages: sanitized.spokenLanguages,
    remoteOnly: sanitized.remoteOnly,
    experienceLevel: sanitized.experienceLevel || null,
    salaryMin: sanitized.salaryMin,
    isActive: sanitized.isActive,
    searchFrequency: sanitized.searchFrequency,
    telegramChatId: resolvedChatId,
    minScore: sanitized.minScore,
  }

  await prisma.botConfig.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...cleaned },
    update: cleaned,
  })

  const tags = cacheTagsFor(user.id)
  revalidateTag(tags.bot, { expire: 0 })
  revalidatePath('/bot/setup')
  revalidatePath('/bot/settings')
  revalidatePath('/bot')
  return { success: true }
}

export async function triggerBotSearch() {
  const user = await requireAuth()

  const config = await prisma.botConfig.findUnique({
    where: { userId: user.id },
  })

  if (!config) {
    return { success: false, error: 'No bot config found. Save your settings first.' }
  }

  const candidateProfile = await loadCandidateProfileForEvaluation(
    user.id,
    config.keywords[0] ?? 'Job Search',
    config
  )
  if (!hasSearchableTerms(config, candidateProfile)) {
    return { success: false, error: BOT_SEARCH_TERMS_REQUIRED_MSG }
  }

  if (!botSearchHasQueryableBackend()) {
    return {
      success: false,
      error:
        'No search backends configured for this environment (or BOT_SEARCH_SOURCES allowlist). Add API keys or adjust BOT_SEARCH_SOURCES.',
    }
  }

  // Must await in-request: `after()` work is not reliable for long jobs on serverless
  // (runtime can freeze/end before search + OpenAI completes), so runs would appear to "finish" with no work.
  const out = await executeBotRunForConfig(config, 'manual')

  revalidateBotRunViews(user.id)

  if (out.error) {
    return {
      success: false,
      error: out.error,
      runId: out.runId,
      jobsFound: out.jobsFound,
      jobsNew: out.jobsNew,
      jobsApproved: out.jobsApproved,
      jobsHardFiltered: out.jobsHardFiltered,
      jobsSkippedLowScore: out.jobsSkippedLowScore,
      jobsEvaluationFailed: out.jobsEvaluationFailed,
    }
  }

  return {
    success: true,
    runId: out.runId,
    jobsFound: out.jobsFound,
    jobsNew: out.jobsNew,
    jobsApproved: out.jobsApproved,
    jobsHardFiltered: out.jobsHardFiltered,
    jobsSkippedLowScore: out.jobsSkippedLowScore,
    jobsEvaluationFailed: out.jobsEvaluationFailed,
  }
}

export async function verifyTelegram(chatId: string) {
  const user = await requireAuth()
  void user // auth check

  if (!chatId.trim()) {
    return { success: false, error: 'Chat ID is required' }
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server' }
  }

  const ok = await verifyTelegramChatId(chatId.trim())
  return ok
    ? { success: true }
    : { success: false, error: 'Could not send test message. Check your chat ID and make sure you have started the bot.' }
}

export async function getBotRuns(limit = 10) {
  const user = await requireAuth()

  const runs = await prisma.botRun.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: 'desc' },
    take: limit,
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

  return runs
}

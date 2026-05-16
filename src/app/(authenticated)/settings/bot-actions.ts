'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { cacheTagsFor } from '@/lib/cache-tags'
import { requireAuth } from '@/lib/auth'
import { verifyTelegramChatId } from '@/lib/bot/telegram'
import { executeBotRunForConfig } from '@/lib/bot/execute-bot-run'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import { BotSearchFrequency } from '@prisma/client'

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

export async function saveBotConfig(data: BotConfigFormData) {
  const user = await requireAuth()

  const resolvedChatId = data.telegramChatId.trim() || null

  const salaryMin =
    data.salaryMin != null && Number.isFinite(data.salaryMin)
      ? Math.floor(data.salaryMin)
      : null
  const minScoreRaw = Number.isFinite(data.minScore) ? data.minScore : 60
  const minScore = Math.max(0, Math.min(100, Math.floor(minScoreRaw)))
  const searchFrequency =
    data.searchFrequency === BotSearchFrequency.TWICE_DAILY
      ? BotSearchFrequency.DAILY
      : data.searchFrequency

  const cleaned = {
    keywords: data.keywords.filter(Boolean),
    locations: data.locations.filter(Boolean),
    excludeCompanies: data.excludeCompanies.filter(Boolean),
    excludeKeywords: data.excludeKeywords.filter(Boolean),
    spokenLanguages: data.spokenLanguages.filter(Boolean),
    remoteOnly: data.remoteOnly,
    experienceLevel: data.experienceLevel || null,
    salaryMin,
    isActive: data.isActive,
    searchFrequency,
    telegramChatId: resolvedChatId,
    minScore,
  }

  await prisma.botConfig.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...cleaned },
    update: cleaned,
  })

  const tags = cacheTagsFor(user.id)
  revalidateTag(tags.bot, { expire: 0 })
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

  if (config.keywords.length === 0) {
    return { success: false, error: 'Add at least one search keyword before running.' }
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

  const tags = cacheTagsFor(user.id)
  revalidateTag(tags.jobs, { expire: 0 })
  revalidateTag(tags.activity, { expire: 0 })
  revalidateTag(tags.notifications, { expire: 0 })
  revalidateTag(tags.bot, { expire: 0 })
  revalidatePath('/jobs')
  revalidatePath('/dashboard')
  revalidatePath('/today')
  revalidatePath('/board')
  revalidatePath('/bot/settings')
  revalidatePath('/bot')
  revalidatePath('/bot/runs')

  if (out.error) {
    return { success: false, error: out.error }
  }

  return { success: true }
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

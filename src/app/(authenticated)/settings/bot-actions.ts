'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { verifyTelegramChatId } from '@/lib/bot/telegram'
import { BotSearchFrequency } from '@prisma/client'

export interface BotConfigFormData {
  keywords: string[]
  locations: string[]
  excludeCompanies: string[]
  excludeKeywords: string[]
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

  const cleaned = {
    keywords: data.keywords.filter(Boolean),
    locations: data.locations.filter(Boolean),
    excludeCompanies: data.excludeCompanies.filter(Boolean),
    excludeKeywords: data.excludeKeywords.filter(Boolean),
    remoteOnly: data.remoteOnly,
    experienceLevel: data.experienceLevel || null,
    salaryMin: data.salaryMin ?? null,
    isActive: data.isActive,
    searchFrequency: data.searchFrequency,
    telegramChatId: data.telegramChatId.trim() || null,
    minScore: Math.max(0, Math.min(100, data.minScore)),
  }

  await prisma.botConfig.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...cleaned },
    update: cleaned,
  })

  revalidatePath('/settings/bot')
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

  if (!process.env.JSEARCH_API_KEY && !process.env.SERP_API_KEY) {
    return {
      success: false,
      error: 'No search API keys configured. Add JSEARCH_API_KEY and/or SERP_API_KEY in Vercel environment variables.',
    }
  }

  // Trigger cron endpoint manually
  const secret = process.env.CRON_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const res = await fetch(`${baseUrl}/api/cron/bot-search`, {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: `Search failed: ${text}` }
    }

    revalidatePath('/settings/bot')
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Search request failed',
    }
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

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runBotSearch } from '@/lib/bot/search-orchestrator'
import { sendBotRunSummary } from '@/lib/bot/telegram'
import type { BotRunSummary } from '@/lib/bot/telegram'
import { BotRunStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'
// Bot searches can take a while across multiple platforms
export const maxDuration = 300

/**
 * Cron: run the job search bot for all active BotConfig users.
 * Schedule: twice daily (08:00 + 20:00 UTC).
 */
export async function GET(request: Request) {
  const vercelCronHeader = request.headers.get('x-vercel-cron')
  const authHeader = request.headers.get('authorization')

  if (process.env.NODE_ENV === 'production') {
    const hasVercelCron = vercelCronHeader === '1' || request.headers.get('x-vercel-signature')
    const hasValidSecret =
      process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!hasVercelCron && !hasValidSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Check that at least one search API key is configured
  if (!process.env.JSEARCH_API_KEY && !process.env.SERP_API_KEY) {
    console.warn('[bot-cron] No search API keys set — set JSEARCH_API_KEY and/or SERP_API_KEY')
    return NextResponse.json(
      { error: 'No search API keys configured (JSEARCH_API_KEY / SERP_API_KEY)' },
      { status: 503 }
    )
  }

  // Load all active bot configs
  const activeConfigs = await prisma.botConfig.findMany({
    where: { isActive: true, keywords: { isEmpty: false } },
  })

  if (activeConfigs.length === 0) {
    return NextResponse.json({ message: 'No active bot configs', usersProcessed: 0 })
  }

  console.log(`[bot-cron] Running for ${activeConfigs.length} active user(s)`)

  const results: Record<string, { jobsNew: number; jobsApproved: number; error?: string }> = {}

  for (const config of activeConfigs) {
    const startedAt = new Date()
    // Create a BotRun record
    const botRun = await prisma.botRun.create({
      data: {
        userId: config.userId,
        botConfigId: config.id,
        status: BotRunStatus.RUNNING,
        source: 'cron',
      },
    })

    try {
      const orchestratorResult = await runBotSearch(config, config.userId)
      const duration = Date.now() - startedAt.getTime()

      await prisma.botRun.update({
        where: { id: botRun.id },
        data: {
          status: BotRunStatus.COMPLETED,
          jobsFound: orchestratorResult.jobsFound,
          jobsNew: orchestratorResult.jobsNew,
          jobsEvaluated: orchestratorResult.jobsEvaluated,
          jobsApproved: orchestratorResult.jobsApproved,
          completedAt: new Date(),
          duration,
          errors: Object.keys(orchestratorResult.errors).length > 0 ? orchestratorResult.errors : undefined,
        },
      })

      // Update lastSearchAt on config
      await prisma.botConfig.update({
        where: { id: config.id },
        data: { lastSearchAt: new Date() },
      })

      results[config.userId] = {
        jobsNew: orchestratorResult.jobsNew,
        jobsApproved: orchestratorResult.jobsApproved,
      }

      // Send Telegram notification if configured and we found something
      if (config.telegramChatId && orchestratorResult.jobsNew > 0) {
        try {
          // Fetch top approved jobs to include in the message
          const topJobs = await prisma.job.findMany({
            where: {
              userId: config.userId,
              tags: { has: 'bot-approved' },
              createdAt: { gte: startedAt },
            },
            select: { title: true, company: true, location: true, url: true, notes: true },
            take: 5,
            orderBy: { createdAt: 'desc' },
          })

          const summary: BotRunSummary = {
            jobsFound: orchestratorResult.jobsFound,
            jobsNew: orchestratorResult.jobsNew,
            jobsApproved: orchestratorResult.jobsApproved,
            topJobs: topJobs.map((j: { title: string; company: string; location: string | null; url: string | null; notes: string | null }) => ({
              title: j.title,
              company: j.company,
              location: j.location,
              url: j.url,
              score: j.notes ? parseInt(j.notes.match(/(\d+)\/100/)?.[1] ?? '0') : undefined,
            })),
            errors: orchestratorResult.errors,
          }

          await sendBotRunSummary(config.telegramChatId, summary)
        } catch (telegramErr) {
          console.error(`[bot-cron] Telegram notification failed for user ${config.userId}:`, telegramErr)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[bot-cron] Failed for user ${config.userId}:`, msg)

      await prisma.botRun.update({
        where: { id: botRun.id },
        data: {
          status: BotRunStatus.FAILED,
          completedAt: new Date(),
          duration: Date.now() - startedAt.getTime(),
          errors: { fatal: msg },
        },
      })

      results[config.userId] = { jobsNew: 0, jobsApproved: 0, error: msg }
    }
  }

  return NextResponse.json({
    usersProcessed: activeConfigs.length,
    results,
  })
}

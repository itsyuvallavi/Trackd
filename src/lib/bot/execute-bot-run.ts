import { BotRunStatus, Prisma } from '@prisma/client'
import type { BotConfig } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { runBotSearch } from '@/lib/bot/search-orchestrator'
import { sendBotRunSummary } from '@/lib/bot/telegram'
import type { BotRunSummary } from '@/lib/bot/telegram'

export type BotRunExecutionResult = {
  jobsNew: number
  jobsApproved: number
  error?: string
}

/**
 * One bot search: BotRun row, orchestrator, persistence, optional Telegram.
 * Used by Vercel cron and by the authenticated "Run now" server action.
 */
export async function executeBotRunForConfig(
  config: BotConfig,
  source: 'cron' | 'manual'
): Promise<BotRunExecutionResult> {
  const startedAt = new Date()
  const botRun = await prisma.botRun.create({
    data: {
      userId: config.userId,
      botConfigId: config.id,
      status: BotRunStatus.RUNNING,
      source,
    },
  })

  try {
    const orchestratorResult = await runBotSearch(config, config.userId, { botRunId: botRun.id })
    const duration = Date.now() - startedAt.getTime()

    const mergedErrors: Record<string, unknown> = { ...orchestratorResult.errors }
    mergedErrors.pipeline =
      `found=${orchestratorResult.jobsFound} ` +
      `dedup_url=${orchestratorResult.skippedExistingByUrl} ` +
      `dedup_title=${orchestratorResult.skippedExistingByTitle} ` +
      `dedup_batch=${orchestratorResult.skippedBatchDuplicate} ` +
      `dedup_dismissed=${orchestratorResult.skippedPreviouslyDismissed} ` +
      `saved=${orchestratorResult.jobsNew} ` +
      `below_min_score=${orchestratorResult.jobsSkippedLowScore} ` +
      `evaluated=${orchestratorResult.jobsEvaluated} ` +
      `approved=${orchestratorResult.jobsApproved}`
    if (orchestratorResult.jobsSkippedLowScore > 0) {
      mergedErrors.skippedBelowMinScore = `${orchestratorResult.jobsSkippedLowScore} listing(s) not saved (AI score below your minimum)`
    }
    if (orchestratorResult.evaluationSkips.length > 0) {
      mergedErrors.evaluationSkips = orchestratorResult.evaluationSkips
    }

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
        searchMeta: orchestratorResult.platformsMeta
          ? (orchestratorResult.platformsMeta as unknown as Prisma.InputJsonValue)
          : undefined,
        errors:
          Object.keys(mergedErrors).length > 0
            ? (mergedErrors as Prisma.InputJsonValue)
            : undefined,
      },
    })

    await prisma.botConfig.update({
      where: { id: config.id },
      data: { lastSearchAt: new Date() },
    })

    if (config.telegramChatId) {
      try {
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
          skippedExistingByUrl: orchestratorResult.skippedExistingByUrl,
          skippedExistingByTitle: orchestratorResult.skippedExistingByTitle,
          skippedBatchDuplicate: orchestratorResult.skippedBatchDuplicate,
          skippedPreviouslyDismissed: orchestratorResult.skippedPreviouslyDismissed,
          skippedLowScore: orchestratorResult.jobsSkippedLowScore,
          minScore: config.minScore,
          topJobs: topJobs.map((j) => ({
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
        console.error(`[bot-run] Telegram notification failed for user ${config.userId}:`, telegramErr)
      }
    }

    return {
      jobsNew: orchestratorResult.jobsNew,
      jobsApproved: orchestratorResult.jobsApproved,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[bot-run] Failed for user ${config.userId}:`, msg)

    await prisma.botRun.update({
      where: { id: botRun.id },
      data: {
        status: BotRunStatus.FAILED,
        completedAt: new Date(),
        duration: Date.now() - startedAt.getTime(),
        errors: { fatal: msg },
      },
    })

    return { jobsNew: 0, jobsApproved: 0, error: msg }
  }
}

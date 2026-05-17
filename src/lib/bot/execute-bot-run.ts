import { BotRunStatus, Prisma } from '@prisma/client'
import type { BotConfig } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { runBotSearch } from '@/lib/bot/search-orchestrator'
import { sendBotRunSummary } from '@/lib/bot/telegram'
import type { BotRunSummary } from '@/lib/bot/telegram'

export type BotRunExecutionResult = {
  runId: string
  jobsFound: number
  jobsNew: number
  jobsApproved: number
  jobsSkippedLowScore: number
  jobsEvaluationFailed: number
  error?: string
}

async function createBotRunNotification(input: {
  userId: string
  botRunId: string
  source: 'cron' | 'manual'
  status: BotRunStatus
  jobsFound: number
  jobsNew: number
  jobsApproved: number
  skippedLowScore: number
  evaluationFailed: number
  fatalError?: string
}) {
  const isError = input.status === BotRunStatus.FAILED || !!input.fatalError || input.evaluationFailed > 0
  const type = isError ? 'SYNC_ERROR' : 'SYNC_COMPLETE'

  let title = 'Job search complete'
  if (input.evaluationFailed > 0 && input.jobsNew === 0) {
    title = 'Job search could not score jobs'
  } else if (input.status === BotRunStatus.FAILED) {
    title = 'Job search failed'
  } else if (input.jobsNew === 0) {
    title = 'Job search found no new matches'
  }

  const lines = [
    `${input.jobsFound} listing${input.jobsFound === 1 ? '' : 's'} found from search.`,
    `${input.jobsNew} saved to your tracker.`,
  ]

  if (input.jobsApproved > 0) {
    lines.push(`${input.jobsApproved} strong match${input.jobsApproved === 1 ? '' : 'es'} approved.`)
  }
  if (input.skippedLowScore > 0) {
    lines.push(`${input.skippedLowScore} below your match threshold or filtered out.`)
  }
  if (input.evaluationFailed > 0) {
    lines.push(`${input.evaluationFailed} could not be scored because the AI provider failed or timed out.`)
  }
  if (input.fatalError) {
    lines.push(`Error: ${input.fatalError.slice(0, 500)}`)
  }

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type,
      title,
      message: lines.join('\n'),
      metadata: {
        kind: 'bot_run',
        botRunId: input.botRunId,
        source: input.source,
        status: input.status,
        jobsFound: input.jobsFound,
        jobsNew: input.jobsNew,
        jobsApproved: input.jobsApproved,
        skippedLowScore: input.skippedLowScore,
        evaluationFailed: input.evaluationFailed,
        fatalError: input.fatalError ?? null,
      },
      actionUrl: '/bot/runs',
    },
  })
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
      `eval_failed=${orchestratorResult.jobsEvaluationFailed} ` +
      `evaluated=${orchestratorResult.jobsEvaluated} ` +
      `approved=${orchestratorResult.jobsApproved}`
    if (orchestratorResult.jobsSkippedLowScore > 0) {
      mergedErrors.skippedBelowMinScore = `${orchestratorResult.jobsSkippedLowScore} listing(s) not saved (AI score below your minimum)`
    }
    if (orchestratorResult.evaluationSkips.length > 0) {
      mergedErrors.evaluationSkips = orchestratorResult.evaluationSkips
    }
    if (orchestratorResult.jobsEvaluationFailed > 0) {
      mergedErrors.evaluationFailed = `${orchestratorResult.jobsEvaluationFailed} listing(s) could not be scored`
    }
    if (orchestratorResult.evaluationFailures.length > 0) {
      mergedErrors.evaluationFailures = orchestratorResult.evaluationFailures
    }

    const status =
      orchestratorResult.jobsEvaluationFailed > 0 &&
      orchestratorResult.jobsNew === 0 &&
      orchestratorResult.jobsSkippedLowScore === 0
        ? BotRunStatus.FAILED
        : BotRunStatus.COMPLETED

    await prisma.botRun.update({
      where: { id: botRun.id },
      data: {
        status,
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

    try {
      await createBotRunNotification({
        userId: config.userId,
        botRunId: botRun.id,
        source,
        status,
        jobsFound: orchestratorResult.jobsFound,
        jobsNew: orchestratorResult.jobsNew,
        jobsApproved: orchestratorResult.jobsApproved,
        skippedLowScore: orchestratorResult.jobsSkippedLowScore,
        evaluationFailed: orchestratorResult.jobsEvaluationFailed,
      })
    } catch (notificationErr) {
      console.error(`[bot-run] In-app notification failed for user ${config.userId}:`, notificationErr)
    }

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
          errors: mergedErrors as Record<string, string>,
        }

        await sendBotRunSummary(config.telegramChatId, summary)
      } catch (telegramErr) {
        console.error(`[bot-run] Telegram notification failed for user ${config.userId}:`, telegramErr)
      }
    }

    if (status === BotRunStatus.FAILED) {
      return {
        runId: botRun.id,
        jobsFound: orchestratorResult.jobsFound,
        jobsNew: orchestratorResult.jobsNew,
        jobsApproved: orchestratorResult.jobsApproved,
        jobsSkippedLowScore: orchestratorResult.jobsSkippedLowScore,
        jobsEvaluationFailed: orchestratorResult.jobsEvaluationFailed,
        error:
          'Search found jobs, but AI scoring failed for all candidates. Check Job Search runs for details.',
      }
    }

    return {
      runId: botRun.id,
      jobsFound: orchestratorResult.jobsFound,
      jobsNew: orchestratorResult.jobsNew,
      jobsApproved: orchestratorResult.jobsApproved,
      jobsSkippedLowScore: orchestratorResult.jobsSkippedLowScore,
      jobsEvaluationFailed: orchestratorResult.jobsEvaluationFailed,
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

    try {
      await createBotRunNotification({
        userId: config.userId,
        botRunId: botRun.id,
        source,
        status: BotRunStatus.FAILED,
        jobsFound: 0,
        jobsNew: 0,
        jobsApproved: 0,
        skippedLowScore: 0,
        evaluationFailed: 0,
        fatalError: msg,
      })
    } catch (notificationErr) {
      console.error(`[bot-run] In-app failure notification failed for user ${config.userId}:`, notificationErr)
    }

    return {
      runId: botRun.id,
      jobsFound: 0,
      jobsNew: 0,
      jobsApproved: 0,
      jobsSkippedLowScore: 0,
      jobsEvaluationFailed: 0,
      error: msg,
    }
  }
}

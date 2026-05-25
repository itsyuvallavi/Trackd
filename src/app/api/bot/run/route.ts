import { after, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import {
  executeStartedBotRunForConfig,
  markStartedBotRunFailed,
  startBotRunForConfig,
} from '@/lib/bot/execute-bot-run'
import { enqueueManualBotRun } from '@/lib/bot/manual-run-queue'
import { revalidateBotRunViews } from '@/lib/bot/revalidate-bot-run-views'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const config = await prisma.botConfig.findUnique({
    where: { userId: user.id },
  })

  if (!config) {
    return NextResponse.json(
      { success: false, error: 'No bot config found. Save your settings first.' },
      { status: 400 }
    )
  }

  if (config.keywords.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Add at least one search keyword before running.' },
      { status: 400 }
    )
  }

  if (!botSearchHasQueryableBackend()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'No search backends configured for this environment (or BOT_SEARCH_SOURCES allowlist). Add API keys or adjust BOT_SEARCH_SOURCES.',
      },
      { status: 503 }
    )
  }

  const started = await startBotRunForConfig(config, 'manual')
  if (!started.started) {
    return NextResponse.json({ success: false, ...started }, { status: 409 })
  }

  const useQueue = process.env.BOT_MANUAL_RUN_USE_QUEUE === '1'

  if (!useQueue) {
    const executionStartedAt = new Date()
    await prisma.botRun.update({
      where: { id: started.runId },
      data: {
        startedAt: executionStartedAt,
        duration: null,
      },
    })

    after(async () => {
      try {
        await executeStartedBotRunForConfig(config, 'manual', {
          id: started.runId,
          startedAt: executionStartedAt,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await markStartedBotRunFailed({
          botRunId: started.runId,
          startedAt: executionStartedAt,
          error: `Manual job search failed after it was started: ${message}`,
          extraErrors: { after: true },
        })
      } finally {
        revalidateBotRunViews(user.id)
      }
    })

    revalidateBotRunViews(user.id)
    return NextResponse.json(
      {
        success: true,
        status: 'started',
        runId: started.runId,
        messageId: null,
        jobsFound: 0,
        jobsNew: 0,
        jobsApproved: 0,
        jobsHardFiltered: 0,
        jobsSkippedLowScore: 0,
        jobsEvaluationFailed: 0,
      },
      { status: 202 }
    )
  }

  try {
    const queued = await enqueueManualBotRun({
      runId: started.runId,
      configId: config.id,
      userId: user.id,
    })
    revalidateBotRunViews(user.id)
    return NextResponse.json(
      {
        success: true,
        status: 'queued',
        runId: started.runId,
        messageId: queued.messageId,
        jobsFound: 0,
        jobsNew: 0,
        jobsApproved: 0,
        jobsHardFiltered: 0,
        jobsSkippedLowScore: 0,
        jobsEvaluationFailed: 0,
      },
      { status: 202 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await markStartedBotRunFailed({
      botRunId: started.runId,
      startedAt: started.startedAt,
      error: `Could not queue manual job search: ${message}`,
      extraErrors: { queue: true },
    })
    revalidateBotRunViews(user.id)
    return NextResponse.json(
      {
        success: false,
        runId: started.runId,
        jobsFound: 0,
        jobsNew: 0,
        jobsApproved: 0,
        jobsHardFiltered: 0,
        jobsSkippedLowScore: 0,
        jobsEvaluationFailed: 0,
        error:
          'Could not queue the job search. The run was marked failed; check Vercel Queues configuration.',
      },
      { status: 503 }
    )
  }
}

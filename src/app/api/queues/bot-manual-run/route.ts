import { BotRunStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  executeStartedBotRunForConfig,
  markStartedBotRunFailed,
} from '@/lib/bot/execute-bot-run'
import {
  handleManualBotRunCallback,
  isBotManualRunMessage,
  type BotManualRunMessage,
} from '@/lib/bot/manual-run-queue'
import { revalidateBotRunViews } from '@/lib/bot/revalidate-bot-run-views'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const handleManualBotRunQueueCallback = handleManualBotRunCallback<BotManualRunMessage>(
  async (message) => {
    if (!isBotManualRunMessage(message)) {
      throw new Error('Invalid manual bot run queue message.')
    }

    const run = await prisma.botRun.findFirst({
      where: {
        id: message.runId,
        userId: message.userId,
        botConfigId: message.configId,
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
      },
    })

    if (!run) {
      throw new Error(`BotRun ${message.runId} not found for queued manual search.`)
    }

    if (run.status !== BotRunStatus.RUNNING) {
      return
    }

    const config = await prisma.botConfig.findFirst({
      where: {
        id: message.configId,
        userId: message.userId,
      },
    })

    if (!config) {
      await markStartedBotRunFailed({
        botRunId: run.id,
        startedAt: run.startedAt,
        error: 'Bot configuration was deleted before the queued manual search could run.',
        extraErrors: { queue: true },
      })
      revalidateBotRunViews(message.userId)
      return
    }

    await executeStartedBotRunForConfig(config, 'manual', {
      id: run.id,
      startedAt: run.startedAt,
    })
    revalidateBotRunViews(message.userId)
  },
  {
    visibilityTimeoutSeconds: 600,
  }
)

export async function POST(request: Request) {
  return handleManualBotRunQueueCallback(request)
}

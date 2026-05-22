import { QueueClient } from '@vercel/queue'

export const BOT_MANUAL_RUN_TOPIC = 'trackd-bot-manual-runs'

export type BotManualRunMessage = {
  runId: string
  configId: string
  userId: string
}

const queue = new QueueClient({ region: process.env.VERCEL_REGION ?? 'iad1' })

export const handleManualBotRunCallback = queue.handleCallback

export function isBotManualRunMessage(value: unknown): value is BotManualRunMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const msg = value as Record<string, unknown>
  return (
    typeof msg.runId === 'string' &&
    typeof msg.configId === 'string' &&
    typeof msg.userId === 'string'
  )
}

export async function enqueueManualBotRun(message: BotManualRunMessage) {
  return queue.send(BOT_MANUAL_RUN_TOPIC, message, {
    idempotencyKey: `bot-run:${message.runId}`,
    retentionSeconds: 24 * 60 * 60,
  })
}

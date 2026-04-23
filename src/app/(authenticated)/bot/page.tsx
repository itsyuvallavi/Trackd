import { requireAuth } from '@/lib/auth'
import { BotQueueContent } from '@/components/bot/bot-queue-content'

export const metadata = { title: 'Job Search — Trackd' }

export default async function BotQueuePage() {
  await requireAuth()
  return <BotQueueContent />
}

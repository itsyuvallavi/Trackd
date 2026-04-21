import { requireAuth } from '@/lib/auth'
import { getEmailIntegration } from '@/lib/cached-queries'
import { BotQueueContent } from '@/components/bot/bot-queue-content'
import { AppShell } from '@/components/layout/app-shell'

export const metadata = { title: 'Bot Queue — Trackd' }

export default async function BotQueuePage() {
  const user = await requireAuth()
  const emailIntegration = await getEmailIntegration(user.id)

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <BotQueueContent />
    </AppShell>
  )
}

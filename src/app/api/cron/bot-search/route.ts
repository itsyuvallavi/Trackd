import { NextResponse } from 'next/server'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { runScheduledBotSearch } from '@/lib/bot/scheduled-bot-search'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Cron: run the job search bot for all active BotConfig users.
 * Production scheduling calls this through the daily-maintenance cron slot.
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runScheduledBotSearch()
  return NextResponse.json(result.body, { status: result.status })
}

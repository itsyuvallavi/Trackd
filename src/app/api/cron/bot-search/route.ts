import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeBotRunForConfig } from '@/lib/bot/execute-bot-run'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'

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

  if (!botSearchHasQueryableBackend()) {
    console.warn(
      '[bot-cron] No backends available — configure JSEARCH_API_KEY and/or Jobs Search API keys / BOT_SEARCH_SOURCES'
    )
    return NextResponse.json(
      {
        error:
          'No search backends configured (keys and/or BOT_SEARCH_SOURCES allowlist)',
      },
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

  const results: Record<
    string,
    { jobsNew: number; jobsApproved: number; error?: string }
  > = {}

  for (const config of activeConfigs) {
    const out = await executeBotRunForConfig(config, 'cron')
    results[config.userId] = out.error
      ? { jobsNew: 0, jobsApproved: 0, error: out.error }
      : { jobsNew: out.jobsNew, jobsApproved: out.jobsApproved }
  }

  return NextResponse.json({
    usersProcessed: activeConfigs.length,
    results,
  })
}

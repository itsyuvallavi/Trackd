import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeBotRunForConfig } from '@/lib/bot/execute-bot-run'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import { isBotConfigDueForSearch } from '@/lib/bot/search-schedule'
import { isCronRequestAuthorized } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
// Bot searches can take a while across multiple platforms
export const maxDuration = 300

/**
 * Cron: run the job search bot for all active BotConfig users.
 * Schedule: twice daily (08:00 + 20:00 UTC).
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Load active bot configs, then apply per-user frequency gates.
  const configuredActiveConfigs = await prisma.botConfig.findMany({
    where: { isActive: true, keywords: { isEmpty: false } },
  })
  const activeConfigs = configuredActiveConfigs.filter((config) =>
    isBotConfigDueForSearch(config),
  )

  if (activeConfigs.length === 0) {
    return NextResponse.json({
      message: configuredActiveConfigs.length === 0
        ? 'No active bot configs'
        : 'No bot configs due for search',
      usersProcessed: 0,
      activeConfigs: configuredActiveConfigs.length,
    })
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

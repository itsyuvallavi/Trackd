import { prisma } from '@/lib/prisma'
import { executeBotRunForConfig } from '@/lib/bot/execute-bot-run'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'
import { isBotConfigDueForSearch } from '@/lib/bot/search-schedule'

type BotSearchCronResponse = {
  status: number
  body: unknown
}

export async function runScheduledBotSearch(): Promise<BotSearchCronResponse> {
  if (!botSearchHasQueryableBackend()) {
    console.warn(
      '[bot-cron] No backends available — configure JOBS_SEARCH_API_KEY / BOT_SEARCH_SOURCES'
    )
    return {
      status: 503,
      body: {
        error:
          'No search backend configured (JOBS_SEARCH_API_KEY and/or BOT_SEARCH_SOURCES allowlist)',
      },
    }
  }

  const configuredActiveConfigs = await prisma.botConfig.findMany({
    where: { isActive: true, keywords: { isEmpty: false } },
  })
  const activeConfigs = configuredActiveConfigs.filter((config) =>
    isBotConfigDueForSearch(config),
  )

  if (activeConfigs.length === 0) {
    return {
      status: 200,
      body: {
        message: configuredActiveConfigs.length === 0
          ? 'No active bot configs'
          : 'No bot configs due for search',
        usersProcessed: 0,
        activeConfigs: configuredActiveConfigs.length,
      },
    }
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

  return {
    status: 200,
    body: {
      usersProcessed: activeConfigs.length,
      results,
    },
  }
}

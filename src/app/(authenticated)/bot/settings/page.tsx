import { requireAuth } from '@/lib/auth'
import { getBotConfigByUserId } from '@/lib/cached-queries'
import { BotSettingsContent } from '@/components/bot/bot-settings-content'
import { serializeForClient } from '@/lib/serialize-for-client'
import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_RESULTS_WANTED,
  describeJSearchDateWindow,
} from '@/lib/bot/search-constants'
import { jobsSearchApiRapidApiKey } from '@/lib/bot/rapidapi-jobs-search-keys'
import { botSearchHasQueryableBackend } from '@/lib/bot/bot-search-sources'

export const metadata = { title: 'Job Search settings — Trackd' }

export default async function BotSettingsPage() {
  const user = await requireAuth()

  const botConfig = await getBotConfigByUserId(user.id)

  const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN
  const searchServiceConfigured = botSearchHasQueryableBackend()

  return (
    <BotSettingsContent
      initialConfig={serializeForClient(botConfig)}
      telegramConfigured={telegramConfigured}
      searchServiceConfigured={searchServiceConfigured}
      searchBackends={{
        jsearch: !!process.env.JSEARCH_API_KEY,
        jobsSearchApi: jobsSearchApiRapidApiKey().length > 0,
      }}
      searchUiCaps={{
        keywordOrMax: BOT_SEARCH_KEYWORD_OR_MAX,
        locationPassesMax: BOT_SEARCH_LOCATION_PASSES_MAX,
        resultsTarget: BOT_SEARCH_RESULTS_WANTED,
        jsearchDateLabel: describeJSearchDateWindow(),
      }}
    />
  )
}

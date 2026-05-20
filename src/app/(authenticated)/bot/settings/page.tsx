import { requireAuth } from '@/lib/auth'
import { getBotConfigByUserId } from '@/lib/cached-queries'
import { BotSettingsContent } from '@/components/bot/bot-settings-content'
import { serializeForClient } from '@/lib/serialize-for-client'
import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_PROVIDER_PASSES_MAX,
  BOT_SEARCH_RESULTS_WANTED,
} from '@/lib/bot/search-constants'
import {
  botSearchHasQueryableBackend,
  effectiveSearchBackends,
} from '@/lib/bot/bot-search-sources'
import { loadCandidateProfileForEvaluation } from '@/lib/bot/candidate-profile'
import { deriveSafeResumeSearchTerms } from '@/lib/bot/search-profile'

export const metadata = { title: 'Job Search settings — Trackd' }

export default async function BotSettingsPage() {
  const user = await requireAuth()

  const botConfig = await getBotConfigByUserId(user.id)

  const telegramConfigured = !!process.env.TELEGRAM_BOT_TOKEN
  const searchServiceConfigured = botSearchHasQueryableBackend()
  const searchBackends = effectiveSearchBackends()
  const candidateProfile = botConfig
    ? await loadCandidateProfileForEvaluation(
        user.id,
        botConfig.keywords[0] ?? 'Job Search',
        botConfig
      )
    : null
  const safeResumeSearchTerms = deriveSafeResumeSearchTerms(candidateProfile)

  return (
    <BotSettingsContent
      initialConfig={serializeForClient(botConfig)}
      telegramConfigured={telegramConfigured}
      searchServiceConfigured={searchServiceConfigured}
      searchBackends={searchBackends}
      safeResumeSearchTerms={safeResumeSearchTerms}
      searchUiCaps={{
        keywordOrMax: BOT_SEARCH_KEYWORD_OR_MAX,
        locationPassesMax: BOT_SEARCH_LOCATION_PASSES_MAX,
        providerPassesMax: BOT_SEARCH_PROVIDER_PASSES_MAX,
        resultsTarget: BOT_SEARCH_RESULTS_WANTED,
      }}
    />
  )
}

import type { BotConfig } from '@prisma/client'
import { BOT_SEARCH_RESULTS_WANTED } from './search-constants'
import type { SearchRequest } from './types'
import type { SafeSearchProfile } from './search-profile'

type BotSearchRequestConfig = Pick<
  BotConfig,
  | 'keywords'
  | 'locations'
  | 'remoteOnly'
  | 'excludeCompanies'
  | 'excludeKeywords'
  | 'experienceLevel'
>

export function buildBotSearchRequest(
  botConfig: BotSearchRequestConfig,
  safeSearchProfile?: Pick<SafeSearchProfile, 'terms'> | null
): SearchRequest {
  const safeTerms = safeSearchProfile?.terms.map((term) => term.trim()).filter(Boolean) ?? []

  return {
    keywords: safeTerms.length > 0 ? safeTerms : botConfig.keywords,
    locations: botConfig.locations.length > 0 ? botConfig.locations : ['Remote'],
    remote_only: botConfig.remoteOnly,
    exclude_companies: botConfig.excludeCompanies,
    exclude_keywords: botConfig.excludeKeywords,
    results_wanted: BOT_SEARCH_RESULTS_WANTED,
    experience_level: botConfig.experienceLevel,
  }
}

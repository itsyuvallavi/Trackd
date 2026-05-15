import type { BotConfig } from '@prisma/client'
import { BOT_SEARCH_RESULTS_WANTED } from './search-constants'
import type { SearchRequest } from './types'

type BotSearchRequestConfig = Pick<
  BotConfig,
  | 'keywords'
  | 'locations'
  | 'remoteOnly'
  | 'excludeCompanies'
  | 'excludeKeywords'
  | 'experienceLevel'
>

export function buildBotSearchRequest(botConfig: BotSearchRequestConfig): SearchRequest {
  return {
    keywords: botConfig.keywords,
    locations: botConfig.locations.length > 0 ? botConfig.locations : ['Remote'],
    remote_only: botConfig.remoteOnly,
    exclude_companies: botConfig.excludeCompanies,
    exclude_keywords: botConfig.excludeKeywords,
    results_wanted: BOT_SEARCH_RESULTS_WANTED,
    experience_level: botConfig.experienceLevel,
  }
}

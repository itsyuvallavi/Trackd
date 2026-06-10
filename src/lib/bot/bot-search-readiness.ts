import type { BotConfig } from '@prisma/client'
import type { CandidateProfile } from './candidate-profile'
import { buildSafeSearchProfile } from './search-profile'

export const BOT_SEARCH_TERMS_REQUIRED_MSG =
  'Add at least one job keyword in Setup, or upload a resume we can derive search terms from.'

type SearchableConfig = Pick<BotConfig, 'keywords'>

export function buildSearchableTerms(
  config: SearchableConfig,
  candidateProfile: CandidateProfile | null
): string[] {
  return buildSafeSearchProfile({ config, candidateProfile }).terms
}

export function hasSearchableTerms(
  config: SearchableConfig,
  candidateProfile: CandidateProfile | null
): boolean {
  return buildSearchableTerms(config, candidateProfile).length > 0
}

import { BotSearchFrequency } from '@prisma/client'
import type { BotConfigFormData } from '@/app/(authenticated)/settings/bot-actions'

export function normalizeSearchFrequency(
  frequency: BotSearchFrequency
): BotSearchFrequency {
  return frequency === BotSearchFrequency.TWICE_DAILY
    ? BotSearchFrequency.DAILY
    : frequency
}

const REGION_ONLY_LOCATION =
  /^(remote|europe|eu|emea|worldwide|global|anywhere)(?:\s+(remote|only))?$/i

/** City or country tokens imply the user accepts on-site / hybrid, not remote-only filtering. */
export function deriveRemoteOnlyFromLocations(
  locations: string[],
  explicitRemoteOnly: boolean
): boolean {
  const trimmed = (locations ?? []).map((l) => l.trim()).filter(Boolean)
  if (trimmed.length === 0) return explicitRemoteOnly

  const hasNonRegionLocation = trimmed.some((loc) => !REGION_ONLY_LOCATION.test(loc))
  if (hasNonRegionLocation) return false

  if (trimmed.some((loc) => /\bremote\b/i.test(loc))) return true
  return explicitRemoteOnly
}

export type SanitizeBotConfigOptions = {
  /** Unified /bot/setup — drop fields removed from the simplified UI. */
  setupLayout?: boolean
}

export function sanitizeBotConfigFormData(
  data: BotConfigFormData,
  options?: SanitizeBotConfigOptions
): BotConfigFormData {
  const keywords = data.keywords.map((k) => k.trim()).filter(Boolean)
  const locations = data.locations.map((l) => l.trim()).filter(Boolean)

  const base: BotConfigFormData = {
    ...data,
    keywords,
    locations,
    excludeCompanies: data.excludeCompanies.map((c) => c.trim()).filter(Boolean),
    excludeKeywords: data.excludeKeywords.map((k) => k.trim()).filter(Boolean),
    spokenLanguages: data.spokenLanguages.map((l) => l.trim()).filter(Boolean),
    remoteOnly: deriveRemoteOnlyFromLocations(locations, data.remoteOnly),
    searchFrequency: normalizeSearchFrequency(data.searchFrequency),
    telegramChatId: data.telegramChatId.trim(),
    experienceLevel: data.experienceLevel.trim(),
    minScore: Math.max(0, Math.min(100, Math.floor(data.minScore))),
    salaryMin:
      data.salaryMin != null && Number.isFinite(data.salaryMin)
        ? Math.floor(data.salaryMin)
        : null,
  }

  if (!options?.setupLayout) return base

  return {
    ...base,
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: [],
    salaryMin: null,
    remoteOnly: deriveRemoteOnlyFromLocations(locations, false),
  }
}

export function normalizeStoredBotConfig<
  T extends {
    searchFrequency: BotSearchFrequency
    remoteOnly: boolean
    locations: string[]
  },
>(config: T): T {
  return {
    ...config,
    searchFrequency: normalizeSearchFrequency(config.searchFrequency),
    remoteOnly: deriveRemoteOnlyFromLocations(config.locations, config.remoteOnly),
  }
}

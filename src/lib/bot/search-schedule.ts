import { BotSearchFrequency } from '@prisma/client'

type BotSearchScheduleConfig = {
  searchFrequency: BotSearchFrequency
  lastSearchAt: Date | null
}

const HOUR_MS = 60 * 60 * 1000

export function minimumSearchIntervalMs(frequency: BotSearchFrequency): number {
  switch (frequency) {
    case BotSearchFrequency.TWICE_DAILY:
      return 12 * HOUR_MS
    case BotSearchFrequency.WEEKLY:
      return 7 * 24 * HOUR_MS
    case BotSearchFrequency.DAILY:
    default:
      return 24 * HOUR_MS
  }
}

export function isBotConfigDueForSearch(
  config: BotSearchScheduleConfig,
  now = new Date(),
): boolean {
  if (!config.lastSearchAt) return true

  return now.getTime() - config.lastSearchAt.getTime() >=
    minimumSearchIntervalMs(config.searchFrequency)
}

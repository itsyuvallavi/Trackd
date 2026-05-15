import { describe, expect, it } from 'vitest'
import { BotSearchFrequency } from '@prisma/client'
import { isBotConfigDueForSearch, minimumSearchIntervalMs } from './search-schedule'

describe('bot search schedule', () => {
  const now = new Date('2026-05-15T08:00:00.000Z')

  it('runs configs that have never searched', () => {
    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.WEEKLY,
        lastSearchAt: null,
      }, now),
    ).toBe(true)
  })

  it('honors daily frequency', () => {
    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.DAILY,
        lastSearchAt: new Date('2026-05-14T08:00:00.000Z'),
      }, now),
    ).toBe(true)

    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.DAILY,
        lastSearchAt: new Date('2026-05-14T20:00:00.000Z'),
      }, now),
    ).toBe(false)
  })

  it('honors twice-daily frequency', () => {
    expect(minimumSearchIntervalMs(BotSearchFrequency.TWICE_DAILY)).toBe(12 * 60 * 60 * 1000)

    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.TWICE_DAILY,
        lastSearchAt: new Date('2026-05-14T20:00:00.000Z'),
      }, now),
    ).toBe(true)

    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.TWICE_DAILY,
        lastSearchAt: new Date('2026-05-15T02:00:00.000Z'),
      }, now),
    ).toBe(false)
  })

  it('honors weekly frequency', () => {
    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.WEEKLY,
        lastSearchAt: new Date('2026-05-08T08:00:00.000Z'),
      }, now),
    ).toBe(true)

    expect(
      isBotConfigDueForSearch({
        searchFrequency: BotSearchFrequency.WEEKLY,
        lastSearchAt: new Date('2026-05-10T08:00:00.000Z'),
      }, now),
    ).toBe(false)
  })
})

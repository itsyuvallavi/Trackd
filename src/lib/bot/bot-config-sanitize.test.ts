import { describe, expect, it } from 'vitest'
import { BotSearchFrequency } from '@prisma/client'
import {
  deriveRemoteOnlyFromLocations,
  normalizeSearchFrequency,
  sanitizeBotConfigFormData,
} from './bot-config-sanitize'
import type { BotConfigFormData } from '@/app/(authenticated)/settings/bot-actions'

function baseForm(overrides: Partial<BotConfigFormData> = {}): BotConfigFormData {
  return {
    keywords: ['Frontend Engineer'],
    locations: ['Remote'],
    excludeCompanies: ['Acme'],
    excludeKeywords: ['staff'],
    spokenLanguages: ['English'],
    remoteOnly: true,
    experienceLevel: 'mid_level',
    salaryMin: 90000,
    isActive: true,
    searchFrequency: BotSearchFrequency.DAILY,
    telegramChatId: '',
    minScore: 75,
    ...overrides,
  }
}

describe('bot-config-sanitize', () => {
  it('coerces TWICE_DAILY to DAILY', () => {
    expect(normalizeSearchFrequency(BotSearchFrequency.TWICE_DAILY)).toBe(
      BotSearchFrequency.DAILY
    )
  })

  it('clears remote-only when city locations are listed', () => {
    expect(
      deriveRemoteOnlyFromLocations(['Remote', 'Lisbon', 'Europe'], true)
    ).toBe(false)
  })

  it('keeps remote-only when only region tokens are listed', () => {
    expect(deriveRemoteOnlyFromLocations(['Remote', 'Europe', 'EU'], false)).toBe(
      true
    )
  })

  it('strips hidden setup fields and stale remote-only on setup saves', () => {
    const cleaned = sanitizeBotConfigFormData(
      baseForm({
        locations: ['Remote', 'Lisbon'],
        remoteOnly: true,
      }),
      { setupLayout: true }
    )

    expect(cleaned).toMatchObject({
      excludeCompanies: [],
      excludeKeywords: [],
      spokenLanguages: [],
      salaryMin: null,
      remoteOnly: false,
    })
  })
})

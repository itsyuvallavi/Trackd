import { describe, expect, it } from 'vitest'
import type { BotConfig } from '@prisma/client'
import type { CandidateProfile } from './candidate-profile'
import { hasSearchableTerms } from './bot-search-readiness'

const config = {
  keywords: [],
} as Pick<BotConfig, 'keywords'>

const parsedProfile: CandidateProfile = {
  resume: {
    name: 'Candidate',
    email: '',
    summary: 'React TypeScript frontend engineer',
    skills: ['React', 'TypeScript', 'Next.js'],
    languages: [],
    experience: [],
    education: [],
    certifications: [],
  },
  source: {
    kind: 'parsed_resume',
    label: 'Parsed resume',
    resumeId: 'r1',
    resumeLabel: 'Main',
    parsedResumeUsed: true,
    rawResumeTextUsed: false,
    applicationIdentitySupplemented: false,
    settingsDerivedSignalsUsed: false,
    settingsSignals: [],
    limitations: [],
  },
}

describe('bot-search-readiness', () => {
  it('allows runs when resume-derived terms exist without settings keywords', () => {
    expect(hasSearchableTerms(config, parsedProfile)).toBe(true)
  })

  it('blocks runs when neither keywords nor resume terms exist', () => {
    expect(hasSearchableTerms(config, null)).toBe(false)
  })
})

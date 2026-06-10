import { describe, expect, it } from 'vitest'
import {
  buildSetupReadiness,
  isApplicationProfileComplete,
} from './setup-readiness'

describe('setup-readiness', () => {
  it('marks profile complete when required identity fields exist', () => {
    expect(
      isApplicationProfileComplete({
        phone: '+351910203349',
        workAuthorization: 'eu_citizen',
        city: 'Lisbon',
        applicationFullName: 'Yuval Lavi',
        applicationEmail: 'info@example.com',
      })
    ).toBe(true)
  })

  it('aggregates setup readiness from resume, profile, and keywords', () => {
    const readiness = buildSetupReadiness({
      resumeCount: 1,
      parsedResumeCount: 1,
      applicationProfile: {
        phone: '+351910203349',
        workAuthorization: 'eu_citizen',
        city: 'Lisbon',
        applicationFullName: 'Yuval Lavi',
        applicationEmail: 'info@example.com',
      },
      keywordCount: 3,
    })

    expect(readiness).toMatchObject({
      hasResume: true,
      hasParsedResume: true,
      hasProfile: true,
      hasKeywords: true,
      hasSearchTerms: true,
      isComplete: true,
    })
  })
})

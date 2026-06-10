import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApplicationProfile } from '@prisma/client'
import { encryptEmailCredential } from '@/lib/email-credential-crypto'
import { buildApplicationKnowledgeBank } from './knowledge-bank'

const baseProfile = {
  applicationFullName: 'Trackd User',
  applicationEmail: 'user@trackd.test',
  phone: null,
  city: null,
  state: null,
  country: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  workAuthorization: null,
  requiresSponsorship: false,
  salaryExpectation: null,
  noticePeriod: null,
  yearsExperience: null,
} as ApplicationProfile

describe('application knowledge bank', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('decrypts stored portal signup passwords before automation use', () => {
    vi.stubEnv('EMAIL_CREDENTIAL_ENCRYPTION_KEY', 'test-credential-key')
    const encryptedPassword = encryptEmailCredential('portal-secret')

    const profile = {
      ...baseProfile,
      portalSignupPassword: encryptedPassword,
    }

    const knowledge = buildApplicationKnowledgeBank(
      { title: 'Engineer', company: 'Trackd' },
      profile,
      null,
    )

    expect(knowledge).toContain('Portal / job-board signup')
    expect(knowledge).toContain('portal-secret')
    expect(knowledge).not.toContain(encryptedPassword)
  })
})

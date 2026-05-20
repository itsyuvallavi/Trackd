import { describe, expect, it } from 'vitest'
import type { ApplicationProfile, BotConfig } from '@prisma/client'
import { buildCandidateProfileFromSources } from './candidate-profile'

function cfg(partial: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg-1',
    userId: 'user-1',
    keywords: ['React Developer', 'AI Engineer'],
    locations: ['Remote'],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: ['English'],
    remoteOnly: true,
    experienceLevel: 'mid_level',
    salaryMin: null,
    isActive: true,
    searchFrequency: 'DAILY',
    lastSearchAt: null,
    telegramChatId: null,
    minScore: 75,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...partial,
  } as BotConfig
}

function identity(partial: Partial<ApplicationProfile> = {}): ApplicationProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    applicationFullName: 'Candidate One',
    applicationEmail: 'candidate@example.com',
    portalSignupPassword: null,
    phone: '+351910203349',
    address: null,
    city: 'Lisbon',
    state: null,
    country: 'Portugal',
    linkedinUrl: 'https://www.linkedin.com/in/example/',
    githubUrl: null,
    portfolioUrl: null,
    workAuthorization: 'EU / EEA Citizen',
    requiresSponsorship: false,
    salaryExpectation: null,
    noticePeriod: 'immediately',
    yearsExperience: 4,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...partial,
  }
}

describe('candidate profile source priority', () => {
  it('uses parsed Job Search resume first and supplements Application Identity', () => {
    const profile = buildCandidateProfileFromSources({
      jobTitle: 'Frontend React Developer',
      config: cfg({ keywords: ['React Developer', 'Python Developer'] }),
      applicationProfile: identity(),
      resumes: [
        {
          id: 'resume-1',
          label: 'Frontend',
          matchKeywords: ['frontend', 'react'],
          isDefault: true,
          rawText: 'React TypeScript Next.js',
          structuredData: {
            name: 'Resume Name',
            email: 'resume@example.com',
            summary: 'Frontend product engineer.',
            skills: ['React', 'TypeScript'],
            languages: [],
            experience: [],
            education: [],
            certifications: [],
          },
        },
      ],
    })

    expect(profile.source).toMatchObject({
      kind: 'parsed_resume',
      resumeId: 'resume-1',
      resumeLabel: 'Frontend',
      parsedResumeUsed: true,
      rawResumeTextUsed: true,
      applicationIdentitySupplemented: true,
      settingsDerivedSignalsUsed: false,
    })
    expect(profile.resume?.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Next.js'])
    )
    expect(profile.resume?.summary).toContain('Application Identity supplemental info')
    expect(profile.resume?.summary).not.toContain('Python Developer')
    expect(profile.source.settingsSignals).toEqual([])
  })

  it('uses raw resume fallback before Application Identity fallback', () => {
    const profile = buildCandidateProfileFromSources({
      jobTitle: 'Frontend Developer',
      config: cfg(),
      applicationProfile: identity(),
      resumes: [
        {
          id: 'resume-raw',
          label: 'Raw Frontend',
          matchKeywords: ['frontend'],
          isDefault: true,
          structuredData: null,
          rawText: 'Frontend Engineer building React, TypeScript, and Tailwind CSS interfaces.',
        },
      ],
    })

    expect(profile.source).toMatchObject({
      kind: 'raw_resume_fallback',
      resumeId: 'resume-raw',
      resumeLabel: 'Raw Frontend',
      rawResumeTextUsed: true,
      applicationIdentitySupplemented: true,
    })
    expect(profile.resume?.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Tailwind CSS'])
    )
    expect(profile.resume?.summary).toContain('Parsed resume fields are unavailable')
  })

  it('falls back to Application Identity and clearly marks settings-derived signals', () => {
    const profile = buildCandidateProfileFromSources({
      jobTitle: 'AI Frontend Engineer',
      config: cfg({ keywords: ['React Developer', 'Full-stack AI Engineer'] }),
      applicationProfile: identity(),
      resumes: [],
    })

    expect(profile.source).toMatchObject({
      kind: 'application_identity_fallback',
      resumeId: null,
      resumeLabel: null,
      applicationIdentitySupplemented: true,
      settingsDerivedSignalsUsed: true,
    })
    expect(profile.source.settingsSignals).toEqual([
      'React',
      'Frontend Engineering',
      'Full-stack Development',
      'AI Engineering',
    ])
    expect(profile.resume?.summary).toContain('No usable Job Search resume content is available')
    expect(profile.resume?.summary).toContain('not resume evidence')
  })

  it('does not let settings keywords replace resume skills when a resume exists', () => {
    const profile = buildCandidateProfileFromSources({
      jobTitle: 'React Developer',
      config: cfg({ keywords: ['Python Developer', 'AI Engineer'] }),
      applicationProfile: identity(),
      resumes: [
        {
          id: 'resume-react',
          label: 'React',
          matchKeywords: ['react'],
          isDefault: true,
          structuredData: {
            name: 'Candidate',
            email: 'candidate@example.com',
            summary: 'Product frontend engineer.',
            skills: ['React', 'TypeScript'],
            languages: [],
            experience: [],
            education: [],
            certifications: [],
          },
          rawText: null,
        },
      ],
    })

    expect(profile.source.kind).toBe('parsed_resume')
    expect(profile.source.settingsDerivedSignalsUsed).toBe(false)
    expect(profile.resume?.skills).toEqual(['React', 'TypeScript'])
    expect(profile.resume?.skills).not.toContain('Python')
    expect(profile.resume?.skills).not.toContain('AI Engineering')
  })

  it('uses settings fallback only when no resume or Application Identity exists', () => {
    const profile = buildCandidateProfileFromSources({
      jobTitle: 'React Developer',
      config: cfg({ keywords: ['React Developer'] }),
      applicationProfile: null,
      resumes: [],
    })

    expect(profile.source).toMatchObject({
      kind: 'settings_fallback',
      settingsDerivedSignalsUsed: true,
      settingsSignals: ['React', 'Frontend Engineering'],
    })
    expect(profile.source.limitations).toContain('No Application Identity fallback exists for this user.')
  })
})

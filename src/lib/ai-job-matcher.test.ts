import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIJobMatcher } from '@/lib/ai-job-matcher'
import { EmailType, type ClassifiedEmail } from '@/lib/ai-email-classifier'
import { JobStatus } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  chatCompletion: vi.fn(),
  getStats: vi.fn(),
}))

vi.mock('@/lib/ai/client', () => ({
  getAIClient: () => ({
    chatCompletion: mocks.chatCompletion,
    getStats: mocks.getStats,
  }),
}))

function aiJson(value: unknown) {
  return {
    data: {
      choices: [
        {
          message: {
            content: JSON.stringify(value),
          },
        },
      ],
    },
  }
}

function classified(company: string, title: string): ClassifiedEmail {
  return {
    type: EmailType.REJECTION,
    confidence: 95,
    suggestedStatus: JobStatus.REJECTED,
    jobInfo: { company, title },
    metadata: {
      keywords: [],
      shouldProcess: true,
      extractedEntities: {
        company,
        title,
        location: null,
      },
    },
  }
}

describe('AIJobMatcher safety gates', () => {
  beforeEach(() => {
    mocks.chatCompletion.mockReset()
    mocks.getStats.mockReset()
  })

  it('rejects AI matches where the extracted company conflicts with the matched job company', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      jobId: 'limesurvey',
      confidence: 88,
      reasoning: 'Title is very similar',
      requiresUserInput: false,
      alternativeMatches: [],
    }))

    const matcher = new AIJobMatcher()
    const result = await matcher.matchToJob(
      classified('Nothing', 'Full Stack Developer'),
      [
        {
          id: 'limesurvey',
          title: 'Full Stack Developer (m/f/d)',
          company: 'LimeSurvey GmbH',
          location: null,
          contactEmail: null,
        },
      ],
      { from: 'no-reply@nothing.tech', subject: 'Update on your application to Nothing' },
    )

    expect(result.confidence).toBe('none')
    expect(result.jobId).toBeNull()
    expect(result.reason).toContain('does not match')
  })

  it('allows AI matches when company differs only by suffix/location decoration', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      jobId: 'vw',
      confidence: 95,
      reasoning: 'Same role and company',
      requiresUserInput: false,
      alternativeMatches: [],
    }))

    const matcher = new AIJobMatcher()
    const result = await matcher.matchToJob(
      classified('Volkswagen Group Digital Solutions', 'Fullstack Developer - Agnostic'),
      [
        {
          id: 'vw',
          title: 'Fullstack Developer - Agnostic',
          company: 'Volkswagen Group Digital Solutions [Portugal]',
          location: null,
          contactEmail: null,
        },
      ],
      { from: 'mail@hire.eu.lever.co', subject: 'VW Group Digital Solutions application update' },
    )

    expect(result.confidence).toBe('exact')
    expect(result.jobId).toBe('vw')
  })

  it('uses AI on a company-focused shortlist for title variations', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      jobId: 'reaktor',
      confidence: 95,
      reasoning: 'Company and role match',
      requiresUserInput: false,
      alternativeMatches: [],
    }))

    const matcher = new AIJobMatcher()
    const result = await matcher.matchToJob(
      classified('Reaktor', 'Full-Stack Developer'),
      [
        {
          id: 'primeit',
          title: 'Full Stack Engineer',
          company: 'PrimeIT',
          location: null,
          contactEmail: null,
        },
        {
          id: 'reaktor',
          title: 'Full-Stack Developer (Lisbon)',
          company: 'Reaktor',
          location: 'Lisbon',
          contactEmail: null,
        },
      ],
      { from: 'lorraine.gualter@reaktor.com', subject: 'Update on your application with Reaktor' },
    )

    expect(mocks.chatCompletion).toHaveBeenCalled()
    const prompt = mocks.chatCompletion.mock.calls[0][0][0].content as string
    expect(prompt).toContain('ID: reaktor')
    expect(prompt).not.toContain('ID: primeit')
    expect(result.confidence).toBe('exact')
    expect(result.jobId).toBe('reaktor')
  })

  it('uses AI on a company-focused shortlist when the email omits the title', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      jobId: 'qualio',
      confidence: 95,
      reasoning: 'Company is enough because only one Qualio job is in the shortlist',
      requiresUserInput: false,
      alternativeMatches: [],
    }))

    const matcher = new AIJobMatcher()
    const result = await matcher.matchToJob(
      classified('Qualio', ''),
      [
        {
          id: 'primeit',
          title: 'Full Stack Engineer',
          company: 'PrimeIT',
          location: null,
          contactEmail: null,
        },
        {
          id: 'qualio',
          title: 'Full Stack Engineer (Remote Ireland / UK)',
          company: 'Qualio',
          location: null,
          contactEmail: null,
        },
      ],
      { from: 'no-reply@qualio.com', subject: 'Update on Your Application at Qualio' },
    )

    expect(mocks.chatCompletion).toHaveBeenCalled()
    const prompt = mocks.chatCompletion.mock.calls[0][0][0].content as string
    expect(prompt).toContain('ID: qualio')
    expect(prompt).not.toContain('ID: primeit')
    expect(result.confidence).toBe('exact')
    expect(result.jobId).toBe('qualio')
  })

  it('does not let broad job history distract company-scoped AI matching', async () => {
    mocks.chatCompletion
      .mockResolvedValueOnce(aiJson({
        jobId: 'vw-infra',
        confidence: 95,
        reasoning: 'same company',
        requiresUserInput: false,
        alternativeMatches: [],
      }))
      .mockResolvedValueOnce(aiJson({
        jobId: 'reaktor',
        confidence: 95,
        reasoning: 'same company',
        requiresUserInput: false,
        alternativeMatches: [],
      }))
      .mockResolvedValueOnce(aiJson({
        jobId: 'primeit',
        confidence: 95,
        reasoning: 'same company',
        requiresUserInput: false,
        alternativeMatches: [],
      }))

    const matcher = new AIJobMatcher()
    const candidates = [
      {
        id: 'qualio',
        title: 'Full Stack Engineer (Remote Ireland / UK)',
        company: 'Qualio',
        location: null,
        contactEmail: null,
      },
      {
        id: 'vw-infra',
        title: 'Fullstack Developer (Infra & Cloud)',
        company: 'Volkswagen Group Digital Solutions [Portugal]',
        location: null,
        contactEmail: null,
      },
      {
        id: 'reaktor',
        title: 'Full-Stack Developer (Lisbon)',
        company: 'Reaktor',
        location: 'Lisbon',
        contactEmail: null,
      },
      {
        id: 'primeit',
        title: 'Full Stack Engineer',
        company: 'PrimeIT',
        location: null,
        contactEmail: null,
      },
    ]

    const vw = await matcher.matchToJob(
      classified('Volkswagen Group Digital Solutions', 'Fullstack Developer (Infra & Cloud)'),
      candidates,
      { from: 'mail@hire.eu.lever.co', subject: 'VW Group Digital Solutions update' },
    )
    const reaktor = await matcher.matchToJob(
      classified('Reaktor', 'Full-Stack Developer'),
      candidates,
      { from: 'lorraine.gualter@reaktor.com', subject: 'Update on your application with Reaktor' },
    )
    const primeit = await matcher.matchToJob(
      classified('PrimeIT', 'Full Stack Engineer'),
      candidates,
      { from: 'inmail-hit-reply@linkedin.com', subject: 'Full Stack Engineer - PrimeIT' },
    )

    expect(vw.jobId).toBe('vw-infra')
    expect(reaktor.jobId).toBe('reaktor')
    expect(primeit.jobId).toBe('primeit')
  })

  it('does not confuse Air Apps with Aira', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      jobId: 'air-apps',
      confidence: 95,
      reasoning: 'Air Apps is the named company',
      requiresUserInput: false,
      alternativeMatches: [],
    }))

    const matcher = new AIJobMatcher()
    const result = await matcher.matchToJob(
      classified('Air Apps', ''),
      [
        {
          id: 'air-apps',
          title: 'Backend Engineer',
          company: 'Air Apps',
          location: null,
          contactEmail: null,
        },
        {
          id: 'aira',
          title: 'Frontend Developer - Planning',
          company: 'Aira',
          location: null,
          contactEmail: null,
        },
      ],
      { from: 'no-reply@ashbyhq.com', subject: 'Thanks for applying to Air Apps!' },
    )

    const prompt = mocks.chatCompletion.mock.calls[0][0][0].content as string
    expect(prompt).toContain('ID: air-apps')
    expect(prompt).not.toContain('ID: aira')
    expect(result.jobId).toBe('air-apps')
  })

  it('shortlists Restream so suffix title variants can match the existing job', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      jobId: 'restream',
      confidence: 92,
      reasoning: 'Software Engineer - Backend is the same backend role',
      requiresUserInput: false,
      alternativeMatches: [],
    }))

    const matcher = new AIJobMatcher()
    const result = await matcher.matchToJob(
      classified('Restream', 'Software Engineer - Backend'),
      [
        {
          id: 'primeit',
          title: 'Data Scientist/IA Engineer',
          company: 'PrimeIT',
          location: null,
          contactEmail: null,
        },
        {
          id: 'restream',
          title: 'Software Engineer - Backend - AI Clips Team',
          company: 'Restream',
          location: null,
          contactEmail: null,
        },
      ],
      { from: 'no-reply@ashbyhq.com', subject: 'Thank you for your application to Restream' },
    )

    const prompt = mocks.chatCompletion.mock.calls[0][0][0].content as string
    expect(prompt).toContain('ID: restream')
    expect(prompt).not.toContain('ID: primeit')
    expect(result.jobId).toBe('restream')
  })
})

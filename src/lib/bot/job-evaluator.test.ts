import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult } from './types'

const chatCompletionMock = vi.fn()
const findManyMock = vi.fn()
const applicationProfileFindUniqueMock = vi.fn()

vi.mock('@/lib/ai/client', () => ({
  getAIClient: () => ({
    chatCompletion: chatCompletionMock,
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botResume: {
      findMany: findManyMock,
    },
    applicationProfile: {
      findUnique: applicationProfileFindUniqueMock,
    },
  },
}))

function cfg(partial: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg-1',
    userId: 'user-1',
    keywords: ['Frontend Engineer'],
    locations: [],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: [],
    remoteOnly: false,
    experienceLevel: 'any',
    salaryMin: null,
    isActive: true,
    searchFrequency: 'DAILY',
    lastSearchAt: null,
    telegramChatId: null,
    minScore: 90,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...partial,
  } as BotConfig
}

function job(partial: Partial<SearchJobResult> = {}): SearchJobResult {
  return {
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    url: 'https://example.com/job',
    description:
      'Build product interfaces with TypeScript, React, accessibility, API integrations, and testing. The role works with designers and backend engineers on customer-facing workflow features.',
    source: 'jobs_search_api',
    is_remote: true,
    ...partial,
  }
}

describe('evaluateJob minScore behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockResolvedValue([])
    applicationProfileFindUniqueMock.mockResolvedValue(null)
  })

  it('does not boost a raw model score to bypass the user minimum', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 45,
                reasoning: 'The title says "Frontend Engineer", but the fit is only partial.',
                shouldApply: false,
                flags: [],
                resumeMatch: 'no resume',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(job(), cfg({ minScore: 90 }))

    expect(result.evaluation.score).toBe(45)
    expect(result.evaluation.shouldApply).toBe(false)
    expect(result.evaluation.flags).not.toContain('clamp_pass_boost')
  })

  it('uses the structured resume whose keywords match the job title', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'resume_backend',
        label: 'Backend',
        matchKeywords: ['backend', 'node'],
        isDefault: false,
        structuredData: {
          name: 'Candidate',
          email: 'candidate@example.com',
          phone: null,
          location: null,
          linkedin: null,
          github: null,
          portfolio: null,
          summary: 'Backend engineer',
          skills: ['Node.js'],
          languages: [],
          experience: [],
          education: [],
          certifications: [],
        },
      },
      {
        id: 'resume_frontend',
        label: 'Frontend',
        matchKeywords: ['frontend', 'react'],
        isDefault: true,
        structuredData: {
          name: 'Candidate',
          email: 'candidate@example.com',
          phone: null,
          location: null,
          linkedin: null,
          github: null,
          portfolio: null,
          summary: 'Frontend engineer',
          skills: ['React', 'TypeScript'],
          languages: [],
          experience: [
            {
              company: 'Acme',
              title: 'Frontend Engineer',
              startDate: '2022',
              endDate: 'Present',
              description: 'Built React TypeScript product workflows.',
              achievements: [],
            },
          ],
          education: [],
          certifications: [],
        },
      },
    ])
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 88,
                reasoning: 'The listing asks for "React TypeScript" work.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'React and TypeScript experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Senior Frontend React Developer',
        description:
          'Build product interfaces with React TypeScript, accessibility, API integrations, and testing.',
      }),
      cfg({ minScore: 75 }),
    )

    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.scoringInputs.resumeUsed).toMatchObject({
      resumeId: 'resume_frontend',
      label: 'Frontend',
      selection: 'matched_by_keywords',
      skillsSentToPrompt: ['React', 'TypeScript'],
    })
  })

  it('falls back to application identity when no parsed resume is available', async () => {
    applicationProfileFindUniqueMock.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      applicationFullName: 'Yuval Lavi',
      applicationEmail: 'info@example.com',
      portalSignupPassword: null,
      phone: '+351910203349',
      address: null,
      city: 'Lisbon',
      state: null,
      country: 'Portugal',
      linkedinUrl: 'https://www.linkedin.com/in/example/',
      githubUrl: 'https://github.com/example',
      portfolioUrl: 'https://example.com',
      workAuthorization: 'EU / EEA Citizen',
      requiresSponsorship: false,
      salaryExpectation: null,
      noticePeriod: 'immediately',
      yearsExperience: 4,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    })
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 62,
                reasoning: 'The listing asks for "React TypeScript" product work.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'application identity fallback',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Frontend React Developer',
        description:
          'Build product interfaces with React TypeScript, accessibility, API integrations, and testing.',
      }),
      cfg({ minScore: 60, spokenLanguages: ['English'], keywords: ['Frontend Developer'] }),
    )

    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.scoringInputs.resumeUsed).toMatchObject({
      resumeId: null,
      label: 'Application identity',
      selection: 'identity_fallback',
      skillsSentToPrompt: ['Frontend Engineering'],
      summaryIncluded: true,
      experienceRolesInPrompt: 1,
    })

    const prompt = chatCompletionMock.mock.calls[0]?.[0]?.[1]?.content as string
    expect(prompt).toContain('No parsed resume is available')
    expect(prompt).toContain('Yuval Lavi')
    expect(prompt).toContain('Reported experience: 4 years')
    expect(prompt).toContain('Preference-derived role/stack signals: Frontend Engineering')
  })

  it('uses preference-derived React/frontend signals when no parsed resume is attached', async () => {
    applicationProfileFindUniqueMock.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      applicationFullName: 'Yuval Lavi',
      applicationEmail: 'info@example.com',
      portalSignupPassword: null,
      phone: '+351910203349',
      address: null,
      city: 'Lisbon',
      state: null,
      country: 'Portugal',
      linkedinUrl: 'https://www.linkedin.com/in/example/',
      githubUrl: 'https://github.com/example',
      portfolioUrl: 'https://example.com',
      workAuthorization: 'EU / EEA Citizen',
      requiresSponsorship: false,
      salaryExpectation: null,
      noticePeriod: 'immediately',
      yearsExperience: 4,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    })
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 80,
                reasoning:
                  'The listing says "Frontend Engineer" and focuses on "modern, scalable, and intelligent user experiences".',
                shouldApply: true,
                flags: ['good_match', 'remote_friendly'],
                resumeMatch: 'React/frontend role preference signals',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Frontend Engineer (Fully Remote) - Global AI-Powered Tech Talent Venture',
        description:
          'Frontend Engineer building modern, scalable, and intelligent user experiences across web applications. 1-3 years of experience working on product interfaces.',
      }),
      cfg({
        minScore: 75,
        keywords: ['React Developer', 'Frontend Developer'],
        experienceLevel: 'mid_level',
      }),
    )

    expect(result.evaluation).toMatchObject({
      score: 80,
      shouldApply: true,
    })
    expect(result.evaluation.flags).not.toContain('stack_mismatch')
    expect(result.scoringInputs.resumeUsed).toMatchObject({
      label: 'Application identity',
      selection: 'identity_fallback',
      skillsSentToPrompt: ['React', 'Frontend Engineering'],
    })
  })

  it('treats seniority as a soft preference instead of blocking strong matches', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'resume_frontend',
        label: 'Frontend',
        matchKeywords: ['frontend', 'react', 'full stack'],
        isDefault: true,
        structuredData: {
          name: 'Candidate',
          email: 'candidate@example.com',
          phone: null,
          location: null,
          linkedin: null,
          github: null,
          portfolio: null,
          summary: 'Frontend engineer focused on React product interfaces.',
          skills: ['React', 'TypeScript', 'Next.js'],
          languages: [],
          experience: [
            {
              company: 'Acme',
              title: 'Frontend Engineer',
              startDate: '2022',
              endDate: 'Present',
              description: 'Built React and TypeScript product workflows.',
              achievements: [],
            },
          ],
          education: [],
          certifications: [],
        },
      },
    ])
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 82,
                reasoning:
                  'The listing asks for "React" and "TypeScript" experience on product interfaces.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'React and TypeScript experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Senior Software Engineer - Full Stack',
        description:
          'Remote full-stack product role building React and TypeScript workflows with API integrations.',
      }),
      cfg({
        minScore: 75,
        keywords: ['React Developer', 'Fullstack Developer'],
        experienceLevel: 'mid_level',
      }),
    )

    expect(result.evaluation.score).toBe(77)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toContain('underqualified')
    expect(result.evaluation.reasoning).toContain('Seniority preference adjustment')
  })

  it('retries once when the evaluator returns malformed JSON', async () => {
    chatCompletionMock
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: '{"score": 76',
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 76,
                  reasoning: 'The listing asks for "React TypeScript" product work.',
                  shouldApply: true,
                  flags: ['good_match'],
                  resumeMatch: 'no resume',
                }),
              },
            },
          ],
        },
      })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Frontend React Developer',
        description:
          'Build product interfaces with React TypeScript, accessibility, API integrations, and testing.',
      }),
      cfg({ minScore: 75 }),
    )

    expect(chatCompletionMock).toHaveBeenCalledTimes(2)
    expect(result.evaluation.score).toBe(76)
    expect(result.evaluation.shouldApply).toBe(true)
  })

  it('throws a clear evaluator error when JSON retry also fails', async () => {
    chatCompletionMock
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: '{"score": 76',
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: '{"score":',
              },
            },
          ],
        },
      })

    const { evaluateJob } = await import('./job-evaluator')
    await expect(evaluateJob(job(), cfg({ minScore: 75 }))).rejects.toThrow(
      'Evaluator returned invalid JSON after retry'
    )
    expect(chatCompletionMock).toHaveBeenCalledTimes(2)
  })

  it('does not crash on sparse parsed resume experience rows', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'resume_sparse',
        label: 'Data',
        matchKeywords: ['data'],
        isDefault: true,
        structuredData: {
          name: 'Candidate',
          email: 'candidate@example.com',
          summary: 'Data analyst',
          skills: ['SQL', 'Tableau'],
          experience: [
            {
              company: 'Acme',
              title: 'Data Analyst',
            },
          ],
          education: [],
        },
      },
    ])
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 70,
                reasoning: 'The title says "Data Analyst" and the description mentions "SQL".',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'SQL experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Data Analyst',
        description: 'Data Analyst role using SQL dashboards and Tableau reporting.',
      }),
      cfg({ keywords: ['Data Analyst'], minScore: 55 }),
    )

    expect(result.evaluation.score).toBe(55)
    expect(result.scoringInputs.resumeUsed.skillsSentToPrompt).toEqual(['SQL', 'Tableau'])
  })

  it('uses raw resume text as backup skill evidence when structured skills are sparse', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'resume_raw',
        label: 'Frontend',
        matchKeywords: ['frontend', 'react'],
        isDefault: true,
        rawText:
          'Frontend Engineer building React, TypeScript, Next.js, Tailwind CSS, REST API integrations, and Supabase workflows.',
        structuredData: {
          name: 'Candidate',
          email: 'candidate@example.com',
          summary: 'Frontend engineer',
          skills: [],
          experience: [],
          education: [],
        },
      },
    ])
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 82,
                reasoning: 'The listing asks for "React TypeScript" product work.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'React and TypeScript resume text',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJob } = await import('./job-evaluator')
    const result = await evaluateJob(
      job({
        title: 'Frontend React Developer',
        description:
          'Build product interfaces with React TypeScript, accessibility, API integrations, and testing.',
      }),
      cfg({ keywords: ['Frontend Developer'], minScore: 75 }),
    )

    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.scoringInputs.resumeUsed.skillsSentToPrompt).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Supabase']),
    )
  })
})

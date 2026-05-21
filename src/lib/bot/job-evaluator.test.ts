import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult } from './types'
import type { CandidateProfile } from './candidate-profile'

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

function candidateProfile(partial: Partial<NonNullable<CandidateProfile['resume']>> = {}): CandidateProfile {
  return {
    resume: {
      name: 'Synthetic Candidate',
      email: 'synthetic@example.invalid',
      summary: 'Entry-level software engineer focused on JavaScript product work.',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL'],
      languages: ['English'],
      experience: [
        {
          company: 'Starter Systems',
          title: 'Software Engineering Intern',
          startDate: '2025',
          endDate: '2026',
          description: 'Built React features, Node.js endpoints, SQL reports, and automated tests.',
          achievements: [],
        },
      ],
      education: [],
      certifications: [],
      ...partial,
    },
    source: {
      kind: 'parsed_resume',
      label: 'Parsed resume',
      resumeId: 'eval_resume_entry',
      resumeLabel: 'Entry Software Engineering',
      parsedResumeUsed: true,
      rawResumeTextUsed: false,
      applicationIdentitySupplemented: false,
      settingsDerivedSignalsUsed: false,
      settingsSignals: [],
      limitations: [],
    },
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
      selection: 'parsed_resume',
      sourceKind: 'parsed_resume',
      sourceLabel: 'Parsed resume',
      skillsSentToPrompt: ['React', 'TypeScript'],
    })
    expect(result.scoringInputs.profileSource).toMatchObject({
      kind: 'parsed_resume',
      resumeId: 'resume_frontend',
      resumeLabel: 'Frontend',
    })
  })

  it('can evaluate against an injected candidate profile without loading DB resumes', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 86,
                reasoning: 'The listing asks for "React TypeScript" product work.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'React and TypeScript experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Frontend React Developer',
        description:
          'Build product interfaces with React TypeScript, accessibility, API integrations, and testing.',
      }),
      cfg({ minScore: 75 }),
      {
        resume: {
          name: 'Synthetic Candidate',
          email: 'synthetic@example.invalid',
          summary: 'Frontend engineer focused on React product interfaces.',
          skills: ['React', 'TypeScript'],
          languages: [],
          experience: [],
          education: [],
          certifications: [],
        },
        source: {
          kind: 'parsed_resume',
          label: 'Parsed resume',
          resumeId: 'eval_resume_frontend',
          resumeLabel: 'Frontend React',
          parsedResumeUsed: true,
          rawResumeTextUsed: false,
          applicationIdentitySupplemented: false,
          settingsDerivedSignalsUsed: false,
          settingsSignals: [],
          limitations: [],
        },
      }
    )

    expect(findManyMock).not.toHaveBeenCalled()
    expect(applicationProfileFindUniqueMock).not.toHaveBeenCalled()
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.scoringInputs.resumeUsed).toMatchObject({
      resumeId: 'eval_resume_frontend',
      sourceKind: 'parsed_resume',
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
      label: null,
      selection: 'application_identity_fallback',
      sourceKind: 'application_identity_fallback',
      sourceLabel: 'Application Identity fallback',
      skillsSentToPrompt: ['Frontend Engineering'],
      summaryIncluded: true,
      experienceRolesInPrompt: 1,
      applicationIdentitySupplemented: true,
      settingsDerivedSignalsUsed: true,
    })

    const prompt = chatCompletionMock.mock.calls[0]?.[0]?.[1]?.content as string
    expect(prompt).toContain('No usable Job Search resume content is available')
    expect(prompt).toContain('Yuval Lavi')
    expect(prompt).toContain('Reported experience: 4 years')
    expect(prompt).toContain('Settings-derived role/stack signals (not resume evidence): Frontend Engineering')
    expect(prompt).toContain('Profile source: Application Identity fallback')
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
      label: null,
      selection: 'application_identity_fallback',
      sourceLabel: 'Application Identity fallback',
      skillsSentToPrompt: ['React', 'Frontend Engineering'],
    })
  })

  it('requires a higher score margin before auto-approving underqualified matches', async () => {
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

    expect(result.evaluation.score).toBe(74)
    expect(result.evaluation.shouldApply).toBe(false)
    expect(result.evaluation.flags).toContain('underqualified')
    expect(result.evaluation.reasoning).toContain('Seniority preference adjustment')
    expect(result.evaluation.reasoning).toContain('Underqualified approval adjustment')
    expect(result.scoringInputs.underqualifiedApprovalClamp).toMatchObject({
      beforeScore: 77,
      afterScore: 74,
      threshold: 75,
      requiredScore: 90,
    })
  })

  it('still auto-approves exceptional underqualified stretch matches', async () => {
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
                score: 98,
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

    expect(result.evaluation.score).toBe(93)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toContain('underqualified')
    expect(result.scoringInputs.seniorityClamp).toMatchObject({
      direction: 'underqualified',
      beforeScore: 98,
      afterScore: 93,
    })
    expect(result.scoringInputs.underqualifiedApprovalClamp).toBeUndefined()
  })

  it('does not treat senior-level users as underqualified for senior titles', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 88,
                reasoning:
                  'The listing asks for SRE, Kubernetes, Terraform, AWS, CI/CD, and incident response experience.',
                shouldApply: true,
                flags: ['good_match', 'underqualified'],
                resumeMatch: 'SRE, Kubernetes, Terraform, AWS, CI/CD, and incident response experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Senior Site Reliability Engineer (SRE)',
        description:
          'Run Kubernetes platforms on AWS using Terraform, Prometheus, CI/CD, and incident response practices.',
      }),
      cfg({
        minScore: 70,
        keywords: ['Site Reliability Engineer', 'DevOps Engineer', 'Platform Engineer'],
        experienceLevel: 'senior_level',
      }),
      candidateProfile({
        summary:
          'SRE and platform engineer with Kubernetes, Terraform, AWS, observability, and incident response experience.',
        skills: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'Incident response', 'CI/CD'],
        experience: [
          {
            company: 'Synthetic Reliability Systems',
            title: 'Site Reliability Engineer',
            startDate: '2019',
            endDate: 'Present',
            description:
              'Operated Kubernetes platforms, Terraform modules, observability, and production incident processes.',
            achievements: [],
          },
        ],
      })
    )

    expect(result.evaluation.score).toBe(88)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toContain('good_match')
    expect(result.evaluation.flags).not.toContain('underqualified')
    expect(result.scoringInputs.seniorityClamp).toBeUndefined()
    expect(result.scoringInputs.underqualifiedApprovalClamp).toBeUndefined()
  })

  it('does not mark entry-level candidates overqualified for graduate roles', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 72,
                reasoning:
                  'The title says "Graduate Software Engineer" and the role asks for product engineering work.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'JavaScript, TypeScript, React, Node.js, and SQL internship work',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Graduate Software Engineer',
        description:
          'Graduate Software Engineer role building product features with JavaScript, TypeScript, React, Node.js, SQL, and mentor support. 0-2 years of experience.',
      }),
      cfg({
        minScore: 65,
        keywords: ['Junior Software Engineer', 'Graduate Developer'],
        experienceLevel: 'entry',
      }),
      candidateProfile()
    )

    expect(result.evaluation.score).toBe(72)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toContain('good_match')
    expect(result.evaluation.flags).not.toContain('overqualified')
    expect(result.scoringInputs.seniorityClamp).toBeUndefined()
  })

  it('removes model-returned overqualified flags when the user is entry-level', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 69,
                reasoning:
                  'The title says "Graduate Software Engineer" and the role asks for React product features.',
                shouldApply: true,
                flags: ['good_match', 'overqualified'],
                resumeMatch: 'React and Node.js internship work',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Graduate Software Engineer',
        description:
          'Graduate Software Engineer role building React product features with JavaScript, Node.js, and SQL. 0-2 years of experience.',
      }),
      cfg({
        minScore: 65,
        keywords: ['Junior Software Engineer', 'Graduate Developer'],
        experienceLevel: 'entry_level',
      }),
      candidateProfile()
    )

    expect(result.evaluation.score).toBe(69)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toEqual(['good_match'])
    expect(result.scoringInputs.seniorityClamp).toBeUndefined()
  })

  it('keeps overqualified as a soft preference for senior users on graduate roles', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 82,
                reasoning:
                  'The title says "Graduate Software Engineer" and the role is an early-career product engineering role.',
                shouldApply: true,
                flags: ['good_match', 'underqualified'],
                resumeMatch: 'Senior product engineering experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Graduate Software Engineer',
        description:
          'Graduate Software Engineer role building product features with JavaScript and TypeScript. 0-2 years of experience.',
      }),
      cfg({
        minScore: 75,
        keywords: ['Software Engineer'],
        experienceLevel: 'senior_level',
      }),
      candidateProfile({
        summary: 'Senior software engineer with JavaScript, TypeScript, React, Node.js, and SQL.',
        experience: [
          {
            company: 'Scale Systems',
            title: 'Senior Software Engineer',
            startDate: '2018',
            endDate: 'Present',
            description: 'Led product engineering teams building React and Node.js systems.',
            achievements: [],
          },
        ],
      })
    )

    expect(result.evaluation.score).toBe(76)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toContain('good_match')
    expect(result.evaluation.flags).toContain('overqualified')
    expect(result.evaluation.flags).not.toContain('underqualified')
    expect(result.scoringInputs.seniorityClamp).toMatchObject({
      direction: 'overqualified',
      beforeScore: 82,
      afterScore: 76,
    })
  })

  it('caps data-science candidates on generic graduate AI software roles', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 78,
                reasoning:
                  'The title says "Graduate AI Software Engineer" and the company builds AI product features.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'Python, data science, and machine learning experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Graduate AI Software Engineer',
        description:
          'Join a graduate software engineering program building AI-powered web product experiences with JavaScript, APIs, and product collaboration. Training and mentorship provided.',
      }),
      cfg({
        minScore: 70,
        keywords: ['Machine Learning Engineer', 'Data Scientist', 'Python ML Engineer'],
        experienceLevel: 'mid_level',
      }),
      candidateProfile({
        summary: 'Data scientist with Python, scikit-learn, SQL, experimentation, and production ML experience.',
        skills: ['Python', 'SQL', 'scikit-learn', 'Pandas', 'A/B testing', 'ML pipelines'],
        experience: [
          {
            company: 'Synthetic Analytics Group',
            title: 'Data Scientist',
            startDate: '2022',
            endDate: 'Present',
            description: 'Built predictive models, feature pipelines, and experiment analysis for product teams.',
            achievements: [],
          },
        ],
      })
    )

    expect(result.evaluation.score).toBe(58)
    expect(result.evaluation.shouldApply).toBe(false)
    expect(result.evaluation.flags).toContain('stack_mismatch')
    expect(result.evaluation.reasoning).toContain('graduate AI software-engineering role')
    expect(result.scoringInputs.stackMismatchClamp).toMatchObject({
      beforeScore: 78,
      afterScore: 58,
    })
  })

  it('does not cap graduate AI software roles when the JD includes explicit ML engineering work', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 78,
                reasoning:
                  'The role includes Python, feature engineering, ML pipelines, and model evaluation work.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'Python, data science, and ML pipeline experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Graduate AI Software Engineer',
        description:
          'Build Python ML pipelines, feature engineering workflows, model evaluation jobs, and scikit-learn prototypes with mentor support.',
      }),
      cfg({
        minScore: 70,
        keywords: ['Machine Learning Engineer', 'Data Scientist', 'Python ML Engineer'],
        experienceLevel: 'mid_level',
      }),
      candidateProfile({
        summary: 'Data scientist with Python, scikit-learn, SQL, experimentation, and production ML experience.',
        skills: ['Python', 'SQL', 'scikit-learn', 'Pandas', 'A/B testing', 'ML pipelines'],
        experience: [
          {
            company: 'Synthetic Analytics Group',
            title: 'Data Scientist',
            startDate: '2022',
            endDate: 'Present',
            description: 'Built predictive models, feature pipelines, and experiment analysis for product teams.',
            achievements: [],
          },
        ],
      })
    )

    expect(result.evaluation.score).toBe(78)
    expect(result.evaluation.shouldApply).toBe(true)
    expect(result.evaluation.flags).toContain('good_match')
    expect(result.evaluation.flags).not.toContain('stack_mismatch')
    expect(result.scoringInputs.stackMismatchClamp).toBeUndefined()
  })

  it('still caps graduate AI software roles when Python appears only in a generic stack list', async () => {
    chatCompletionMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 75,
                reasoning:
                  'The title says "Graduate AI Software Engineer" and the JD mentions Python in a broad engineering stack.',
                shouldApply: true,
                flags: ['good_match'],
                resumeMatch: 'Python, data science, and ML pipeline experience',
              }),
            },
          },
        ],
      },
    })

    const { evaluateJobWithCandidateProfile } = await import('./job-evaluator')
    const result = await evaluateJobWithCandidateProfile(
      job({
        title: 'Graduate AI Software Engineer',
        description:
          'Build software with end-to-end ownership, choosing the right technologies for each challenge. From monoliths to microservices, gRPC to REST, Kubernetes to Docker, Python to Rust, you will apply technologies thoughtfully and ship software used by millions.',
      }),
      cfg({
        minScore: 70,
        keywords: ['Machine Learning Engineer', 'Data Scientist', 'Python ML Engineer'],
        experienceLevel: 'mid_level',
      }),
      candidateProfile({
        summary: 'Data scientist with Python, scikit-learn, SQL, experimentation, and production ML experience.',
        skills: ['Python', 'SQL', 'scikit-learn', 'Pandas', 'A/B testing', 'ML pipelines'],
        experience: [
          {
            company: 'Synthetic Analytics Group',
            title: 'Data Scientist',
            startDate: '2022',
            endDate: 'Present',
            description: 'Built predictive models, feature pipelines, and experiment analysis for product teams.',
            achievements: [],
          },
        ],
      })
    )

    expect(result.evaluation.score).toBe(58)
    expect(result.evaluation.shouldApply).toBe(false)
    expect(result.evaluation.flags).toContain('stack_mismatch')
    expect(result.scoringInputs.stackMismatchClamp).toMatchObject({
      beforeScore: 75,
      afterScore: 58,
    })
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

import { describe, expect, it } from 'vitest'
import type { BotConfig } from '@prisma/client'
import type { CandidateProfile } from './candidate-profile'
import {
  buildSafeSearchProfile,
  buildSafeSearchTerms,
  deriveSafeResumeSearchTerms,
  refineSearchKeywordForProvider,
} from './search-profile'

function config(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    id: 'cfg_1',
    userId: 'user_1',
    keywords: ['Frontend Engineer'],
    locations: ['Remote Europe'],
    excludeCompanies: [],
    excludeKeywords: [],
    spokenLanguages: ['en'],
    remoteOnly: true,
    experienceLevel: 'mid_level',
    salaryMin: null,
    searchFrequency: 'DAILY',
    isActive: true,
    minScore: 70,
    lastSearchAt: null,
    telegramChatId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function parsedProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    resume: {
      name: 'Candidate One',
      email: 'candidate@example.com',
      phone: '+351 912 345 678',
      location: 'Secret Street 1, Lisbon',
      linkedin: 'https://linkedin.example/candidate-one',
      portfolio: 'https://portfolio.example',
      summary:
        'Frontend engineer with React, Next.js, TypeScript, Local LLMs, context retrieval, and developer tooling experience.',
      skills: [
        'React',
        'Next.js',
        'TypeScript',
        'CSS',
        'Prisma',
        'PostgreSQL',
        'Supabase',
        'Local LLMs',
        'Developer Tooling',
      ],
      languages: [],
      experience: [
        {
          company: 'Private Employer',
          title: 'Product Engineer',
          startDate: '2024',
          endDate: 'Present',
          description:
            'Built raw confidential workflow automation for a named internal product.',
          achievements: [],
        },
      ],
      education: [],
      certifications: [],
    },
    source: {
      kind: 'parsed_resume',
      label: 'Parsed Job Search resume',
      resumeId: 'resume_1',
      resumeLabel: 'Job Search resume',
      parsedResumeUsed: true,
      rawResumeTextUsed: false,
      applicationIdentitySupplemented: true,
      settingsDerivedSignalsUsed: false,
      settingsSignals: [],
      limitations: [],
    },
    ...overrides,
  }
}

describe('search profile', () => {
  it('derives bounded role and stack terms from parsed resume evidence', () => {
    const profile = buildSafeSearchProfile({
      config: config({
        keywords: ['Fullstack Developer', 'React Developer', 'Frontend Developer', 'AI Engineer'],
      }),
      candidateProfile: parsedProfile(),
    })

    expect(profile.derivedFromResume).toBe(true)
    expect(profile.profileSource).toMatchObject({
      kind: 'parsed_resume',
      resumeId: 'resume_1',
      resumeLabel: 'Job Search resume',
    })
    expect(profile.terms).toEqual([
      'React TypeScript Developer',
      'Next.js Frontend Engineer',
      'Frontend Engineer',
      'Full Stack Engineer',
      'Backend TypeScript Engineer',
    ])
  })

  it('does not leak raw resume, identity, or contact fields into safe search terms', () => {
    const terms = deriveSafeResumeSearchTerms(parsedProfile())
    const text = terms.join(' ')

    expect(text).not.toContain('Candidate One')
    expect(text).not.toContain('candidate@example.com')
    expect(text).not.toContain('+351')
    expect(text).not.toContain('linkedin.example')
    expect(text).not.toContain('portfolio.example')
    expect(text).not.toContain('Secret Street')
    expect(text).not.toContain('Private Employer')
    expect(text).not.toContain('raw confidential workflow')
    expect(terms.every((term) => !/[@\n]|\bhttps?:/i.test(term))).toBe(true)
    expect(terms.every((term) => term.split(/\s+/).length <= 4)).toBe(true)
  })

  it('constrains resume-derived terms to the saved settings direction', () => {
    const terms = buildSafeSearchTerms({
      settingsKeywords: ['Frontend Engineer'],
      resumeSearchTerms: [
        'Frontend Engineer',
        'React TypeScript Developer',
        'Full Stack Engineer',
        'Backend TypeScript Engineer',
        'LLM Engineer',
        'Developer Tooling Engineer',
      ],
    })

    expect(terms).toEqual(['Frontend Engineer', 'React TypeScript Developer'])
    expect(terms).not.toContain('LLM Engineer')
    expect(terms).not.toContain('Developer Tooling Engineer')
  })

  it('uses settings as fallback search terms when no resume evidence exists', () => {
    const profile = buildSafeSearchProfile({
      config: config({ keywords: ['Product Manager'] }),
      candidateProfile: null,
    })

    expect(profile).toMatchObject({
      terms: ['Product Manager'],
      resumeSearchTerms: [],
      settingsKeywords: ['Product Manager'],
      derivedFromResume: false,
      profileSource: {
        kind: 'none',
        resumeId: null,
        resumeLabel: null,
      },
    })
  })

  it('keeps product-minded engineering searches constrained to engineering terms', () => {
    const terms = deriveSafeResumeSearchTerms(parsedProfile({
      resume: {
        ...parsedProfile().resume!,
        summary:
          'Product-minded full-stack engineer working across TypeScript, Node.js, PostgreSQL, and React.',
        skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'React', 'Prisma'],
        experience: [
          {
            company: 'Synthetic Workflow Labs',
            title: 'Senior Product Engineer',
            startDate: '2020',
            endDate: 'Present',
            description:
              'Owned backend services, data models, and frontend product workflows for a B2B SaaS application.',
            achievements: [],
          },
        ],
      },
    }))

    expect(terms).toEqual(expect.arrayContaining([
      'Full Stack Engineer',
      'Backend TypeScript Engineer',
      'Full Stack Product Engineer',
    ]))
    expect(terms).not.toContain('Product Engineer')
    expect(refineSearchKeywordForProvider('Product Engineer')).toBe('Software Product Engineer')
  })

  it('derives safe resume-backed terms for non-frontend professions', () => {
    const cases = [
      {
        keywords: ['Data Scientist', 'Machine Learning Engineer'],
        resume: {
          summary:
            'Data scientist focused on statistical models, machine learning, Python, pandas, NumPy, and scikit-learn.',
          skills: ['Python', 'Pandas', 'NumPy', 'Machine Learning', 'Data Science'],
          experience: [
            {
              title: 'Data Scientist',
              description:
                'Built statistical models and machine learning reporting pipelines for synthetic analytics data.',
            },
          ],
        },
        expected: ['Data Scientist', 'Machine Learning Engineer'],
      },
      {
        keywords: ['Product Manager'],
        resume: {
          summary:
            'Product manager with roadmap ownership, discovery, stakeholder alignment, and user stories.',
          skills: ['Product Management', 'Roadmap Planning', 'Discovery'],
          experience: [
            {
              title: 'Product Manager',
              description:
                'Led roadmap planning, user research, stakeholder reviews, and prioritization for workflow products.',
            },
          ],
        },
        expected: ['Product Manager'],
      },
      {
        keywords: ['QA Automation Engineer'],
        resume: {
          summary:
            'QA automation engineer building Playwright, Cypress, Selenium, and quality assurance suites.',
          skills: ['QA', 'Quality Assurance', 'Playwright', 'Cypress', 'Selenium'],
          experience: [
            {
              title: 'QA Automation Engineer',
              description:
                'Owned test automation coverage, release validation, and browser regression workflows.',
            },
          ],
        },
        expected: [
          'QA Automation Engineer',
          'Test Automation Engineer',
          'SDET',
          'Playwright QA Engineer',
        ],
      },
      {
        keywords: ['DevOps Engineer', 'Site Reliability Engineer'],
        resume: {
          summary:
            'DevOps and SRE engineer with Kubernetes, Terraform, AWS, CI CD, observability, and incident response.',
          skills: ['DevOps', 'Kubernetes', 'Terraform', 'AWS', 'Observability'],
          experience: [
            {
              title: 'Site Reliability Engineer',
              description:
                'Improved platform reliability with infrastructure automation, alerts, and incident response.',
            },
          ],
        },
        expected: ['Site Reliability Engineer', 'DevOps Engineer'],
      },
      {
        keywords: ['Product Designer', 'UX Designer'],
        resume: {
          summary:
            'Product designer and UX designer using Figma, user research, wireframes, prototypes, and design systems.',
          skills: ['UX', 'Figma', 'User Research', 'Design Systems', 'Interaction Design'],
          experience: [
            {
              title: 'Product Designer',
              description:
                'Designed prototypes, wireframes, interaction design flows, and reusable design system components.',
            },
          ],
        },
        expected: ['Product Designer', 'UX Designer'],
      },
      {
        keywords: ['Junior Software Engineer'],
        resume: {
          summary:
            'Entry-level software engineer with computer science, algorithms, data structures, and internship projects.',
          skills: ['Software Engineering', 'JavaScript', 'Algorithms', 'Data Structures'],
          experience: [
            {
              title: 'Software Engineering Intern',
              description:
                'Completed internship and capstone software engineer projects using APIs and web applications.',
            },
          ],
        },
        expected: ['Software Engineer', 'Junior Software Engineer'],
      },
    ]

    for (const testCase of cases) {
      const profile = buildSafeSearchProfile({
        config: config({ keywords: testCase.keywords }),
        candidateProfile: parsedProfile({
          resume: {
            ...parsedProfile().resume!,
            summary: testCase.resume.summary,
            skills: testCase.resume.skills,
            experience: testCase.resume.experience.map((entry) => ({
              company: 'Synthetic Employer',
              title: entry.title,
              startDate: '2024',
              endDate: 'Present',
              description: entry.description,
              achievements: [],
            })),
          },
        }),
      })

      expect(profile.terms).toEqual(testCase.expected)
      expect(profile.derivedFromResume).toBe(true)
    }
  })

  it('refines broad developer keywords without inventing raw resume text', () => {
    expect(refineSearchKeywordForProvider('React Developer')).toBe('React TypeScript Developer')
    expect(refineSearchKeywordForProvider('Fullstack Developer')).toBe('Full Stack Engineer')
    expect(refineSearchKeywordForProvider('AI Engineer')).toBe('LLM Engineer')
    expect(refineSearchKeywordForProvider('Machine Learning')).toBe('Machine Learning Engineer')
    expect(refineSearchKeywordForProvider('QA')).toBe('QA Automation Engineer')
    expect(refineSearchKeywordForProvider('SDET')).toBe('SDET')
    expect(refineSearchKeywordForProvider('Playwright QA')).toBe('Playwright QA Engineer')
    expect(refineSearchKeywordForProvider('SRE')).toBe('Site Reliability Engineer')
  })
})

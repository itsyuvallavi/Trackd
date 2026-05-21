import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  botRun: {
    findMany: vi.fn(),
  },
  job: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}))

const columnMock = vi.hoisted(() => ({
  getPublicJobTableColumnNames: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/prisma-job-columns', () => ({
  getPublicJobTableColumnNames: columnMock.getPublicJobTableColumnNames,
}))

import {
  getBotRunsList,
  getUserJobsListRows,
  profileSourceFromScoringInputs,
  summarizeProfileSources,
} from './cached-queries'

describe('bot run profile source summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    columnMock.getPublicJobTableColumnNames.mockResolvedValue(
      new Set(['importSource', 'importJobBoard'])
    )
  })

  it('reads canonical profileSource metadata', () => {
    expect(
      profileSourceFromScoringInputs({
        profileSource: {
          kind: 'parsed_resume',
          label: 'Parsed resume',
          resumeLabel: 'Main resume',
          applicationIdentitySupplemented: true,
          settingsDerivedSignalsUsed: false,
          limitations: [],
        },
      })
    ).toEqual({
      kind: 'parsed_resume',
      label: 'Parsed resume',
      resumeLabel: 'Main resume',
      applicationIdentitySupplemented: true,
      settingsDerivedSignalsUsed: false,
      limitations: [],
    })
  })

  it('maps legacy resumeUsed selections so old successful runs remain debuggable', () => {
    expect(
      profileSourceFromScoringInputs({
        resumeUsed: {
          resumeId: 'resume_1',
          label: 'Yuval Lavi Resume Final Cleaned',
          selection: 'matched_by_keywords',
        },
      })
    ).toEqual({
      kind: 'parsed_resume',
      label: 'Parsed resume',
      resumeLabel: 'Yuval Lavi Resume Final Cleaned',
      applicationIdentitySupplemented: false,
      settingsDerivedSignalsUsed: false,
      limitations: ['Legacy run metadata did not include full profile-source diagnostics.'],
    })
  })

  it('summarizes matching sources across listing rows', () => {
    expect(
      summarizeProfileSources([
        {
          scoringInputs: {
            profileSource: {
              kind: 'parsed_resume',
              label: 'Parsed resume',
              resumeLabel: 'Main resume',
            },
          },
        },
        {
          scoringInputs: {
            resumeUsed: {
              resumeId: 'resume_1',
              label: 'Main resume',
              selection: 'matched_by_keywords',
            },
          },
        },
        {
          scoringInputs: {
            note: 'AI evaluator was not run for this listing.',
          },
        },
      ])
    ).toEqual([
      expect.objectContaining({
        kind: 'parsed_resume',
        resumeLabel: 'Main resume',
        listings: 2,
      }),
    ])
  })

  it('keeps the bot runs list query off full listing scoringInputs while returning profileSources', async () => {
    const startedAt = new Date('2026-05-20T10:00:00.000Z')
    prismaMock.botRun.findMany.mockResolvedValue([
      {
        id: 'run_1',
        status: 'completed',
        source: 'manual',
        jobsFound: 3,
        jobsNew: 2,
        jobsApproved: 1,
        startedAt,
        completedAt: new Date('2026-05-20T10:01:00.000Z'),
        duration: 60_000,
        errors: {
          pipeline: 'found=3 new=2 evaluated=2 approved=1',
          evaluationSkips: [{ title: 'Skipped role' }],
        },
      },
    ])
    prismaMock.$queryRaw.mockResolvedValue([
      {
        botRunId: 'run_1',
        profileSource: {
          kind: 'parsed_resume',
          label: 'Parsed resume',
          resumeLabel: 'Main resume',
        },
        resumeUsed: {},
      },
      {
        botRunId: 'run_1',
        profileSource: {},
        resumeUsed: {
          resumeId: 'resume_1',
          label: 'Main resume',
          selection: 'matched_by_keywords',
        },
      },
    ])

    await expect(getBotRunsList('user_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'run_1',
        errors: expect.objectContaining({
          pipeline: 'found=3 new=2 evaluated=2 approved=1',
          evaluationSkips: [{ title: 'Skipped role' }],
        }),
        profileSources: [
          expect.objectContaining({
            kind: 'parsed_resume',
            resumeLabel: 'Main resume',
            listings: 2,
          }),
        ],
      }),
    ])

    expect(prismaMock.botRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          botRunListings: expect.anything(),
        }),
      })
    )
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('uses a slim jobs-page projection instead of full job rows', async () => {
    const createdAt = new Date('2026-05-21T10:00:00.000Z')
    prismaMock.job.findMany.mockResolvedValue([
      {
        id: 'job_1',
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        status: 'SAVED',
        source: 'BOT',
        tags: ['bot-approved'],
        notes: 'Review later',
        createdAt,
        importSource: 'jobs_search_api',
        importJobBoard: 'linkedin',
      },
    ])

    await expect(getUserJobsListRows('user_1')).resolves.toEqual([
      {
        id: 'job_1',
        title: 'Frontend Engineer',
        company: 'Acme',
        location: 'Remote',
        status: 'SAVED',
        source: 'BOT',
        tags: ['bot-approved'],
        notes: 'Review later',
        createdAt,
        importSource: 'jobs_search_api',
        importJobBoard: 'linkedin',
      },
    ])

    expect(prismaMock.job.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        status: true,
        source: true,
        tags: true,
        notes: true,
        createdAt: true,
        importSource: true,
        importJobBoard: true,
      },
      orderBy: { savedAt: 'desc' },
      take: 100,
    })
  })
})

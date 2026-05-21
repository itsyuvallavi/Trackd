import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  applicationProfileFindUnique: vi.fn(),
  jobFindMany: vi.fn(),
  getPublicJobTableColumnNames: vi.fn(),
  jobSourceDisplayName: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    applicationProfile: {
      findUnique: mocks.applicationProfileFindUnique,
    },
    job: {
      findMany: mocks.jobFindMany,
    },
  },
}))

vi.mock('@/lib/prisma-job-columns', () => ({
  getPublicJobTableColumnNames: mocks.getPublicJobTableColumnNames,
}))

vi.mock('@/lib/job-source-display', () => ({
  jobSourceDisplayName: mocks.jobSourceDisplayName,
}))

function jobRow(partial: Partial<{
  id: string
  title: string
  company: string
  botScore: number | null
  savedAt: Date
  createdAt: Date
}> = {}) {
  return {
    id: partial.id ?? 'job_1',
    title: partial.title ?? 'Frontend Engineer',
    company: partial.company ?? 'Acme',
    location: 'Remote',
    url: `https://example.test/${partial.id ?? 'job_1'}`,
    salary: null,
    source: 'BOT',
    importSource: 'jobs_search_api',
    importJobBoard: 'linkedin',
    tags: ['bot-found', 'bot-approved'],
    botScore: partial.botScore ?? 80,
    botReasoning: 'Strong match.',
    coverLetter: null,
    savedAt: partial.savedAt ?? new Date('2026-05-21T10:00:00.000Z'),
    createdAt: partial.createdAt ?? new Date('2026-05-21T10:00:00.000Z'),
  }
}

describe('/api/bot/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.applicationProfileFindUnique.mockResolvedValue({
      phone: '+351910000000',
      workAuthorization: 'EU',
      city: 'Lisbon',
      applicationFullName: 'Candidate',
      applicationEmail: 'candidate@example.test',
    })
    mocks.getPublicJobTableColumnNames.mockResolvedValue(new Set(['importSource', 'importJobBoard']))
    mocks.jobSourceDisplayName.mockReturnValue('Jobs Search API · LinkedIn')
    mocks.jobFindMany.mockResolvedValueOnce([
      jobRow({
        id: 'newer_lower_score',
        title: 'Newer Lower Score',
        botScore: 70,
        savedAt: new Date('2026-05-21T12:00:00.000Z'),
        createdAt: new Date('2026-05-21T12:00:00.000Z'),
      }),
      jobRow({
        id: 'older_higher_score',
        title: 'Older Higher Score',
        botScore: 95,
        savedAt: new Date('2026-05-20T12:00:00.000Z'),
        createdAt: new Date('2026-05-20T12:00:00.000Z'),
      }),
    ])
    mocks.jobFindMany.mockResolvedValueOnce([])
  })

  it('loads bot-approved jobs newest-first rather than score-first', async () => {
    const { GET } = await import('./route')
    const response = await GET(new Request('https://trackd.test/api/bot/queue?limit=50&offset=0'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.jobFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: [{ savedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    )
    expect(body.jobs.map((job: { id: string }) => job.id)).toEqual([
      'newer_lower_score',
      'older_higher_score',
    ])
    expect(body.jobs[0]).toMatchObject({
      savedAt: '2026-05-21T12:00:00.000Z',
      botScore: 70,
    })
  })
})

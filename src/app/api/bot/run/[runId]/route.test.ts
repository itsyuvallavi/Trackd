import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  botRunFindFirst: vi.fn(),
  botRunUpdateMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botRun: {
      findFirst: mocks.botRunFindFirst,
      updateMany: mocks.botRunUpdateMany,
    },
  },
}))

function params(runId: string) {
  return { params: Promise.resolve({ runId }) }
}

describe('/api/bot/run/[runId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.botRunUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('marks stale running runs failed for progress polling', async () => {
    mocks.botRunFindFirst.mockResolvedValue({
      id: 'run_1',
      status: 'RUNNING',
      source: 'manual',
      jobsFound: 45,
      jobsNew: 0,
      jobsEvaluated: 0,
      jobsApproved: 0,
      startedAt: new Date(Date.now() - 11 * 60 * 1000),
      completedAt: null,
      duration: null,
    })

    const { GET } = await import('./route')
    const response = await GET({} as never, params('run_1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('FAILED')
    expect(body.startedAt).toEqual(expect.any(String))
    expect(body.completedAt).toEqual(expect.any(String))
    expect(body.errors).toBeUndefined()
    expect(body.searchMeta).toBeUndefined()
    expect(mocks.botRunUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'run_1',
          userId: 'user_1',
          status: 'RUNNING',
        },
        data: expect.objectContaining({
          status: 'FAILED',
          errors: expect.objectContaining({ stale: true }),
        }),
      }),
    )
  })

  it('returns a lightweight completed run snapshot', async () => {
    mocks.botRunFindFirst.mockResolvedValue({
      id: 'run_1',
      status: 'COMPLETED',
      source: 'manual',
      jobsFound: 45,
      jobsNew: 7,
      jobsEvaluated: 21,
      jobsApproved: 7,
      startedAt: new Date('2026-06-08T11:36:21.224Z'),
      completedAt: new Date('2026-06-08T11:38:16.643Z'),
      duration: 115419,
    })

    const { GET } = await import('./route')
    const response = await GET({} as never, params('run_1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      id: 'run_1',
      status: 'COMPLETED',
      jobsFound: 45,
      jobsNew: 7,
      jobsEvaluated: 21,
      jobsApproved: 7,
    })
    expect(body.errors).toBeUndefined()
    expect(body.searchMeta).toBeUndefined()
    expect(mocks.botRunUpdateMany).not.toHaveBeenCalled()
  })
})

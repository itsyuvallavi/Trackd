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

describe('/api/bot/run/active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.botRunUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('expires stale active runs instead of returning them', async () => {
    mocks.botRunFindFirst.mockResolvedValue({
      id: 'run_stale',
      status: 'RUNNING',
      source: 'manual',
      jobsFound: 45,
      jobsNew: 0,
      jobsEvaluated: 0,
      jobsApproved: 0,
      startedAt: new Date(Date.now() - 11 * 60 * 1000),
      duration: null,
    })

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ run: null })
    expect(mocks.botRunUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'run_stale',
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

  it('returns a lightweight fresh active run snapshot', async () => {
    mocks.botRunFindFirst.mockResolvedValue({
      id: 'run_active',
      status: 'RUNNING',
      source: 'manual',
      jobsFound: 10,
      jobsNew: 1,
      jobsEvaluated: 4,
      jobsApproved: 1,
      startedAt: new Date(),
      duration: null,
    })

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.run).toMatchObject({
      id: 'run_active',
      status: 'RUNNING',
      jobsFound: 10,
      jobsEvaluated: 4,
    })
    expect(body.run.errors).toBeUndefined()
    expect(body.run.searchMeta).toBeUndefined()
    expect(mocks.botRunUpdateMany).not.toHaveBeenCalled()
  })
})

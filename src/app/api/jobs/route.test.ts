import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  jobFindMany: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: mocks.jobFindMany,
    },
  },
}))

function request(url: string) {
  return { nextUrl: new URL(url) } as never
}

describe('/api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.jobFindMany.mockResolvedValue([])
  })

  it('does not cap the jobs list by default', async () => {
    const { GET } = await import('./route')

    await GET(request('https://trackd.test/api/jobs'))

    expect(mocks.jobFindMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        take: expect.any(Number),
      }),
    )
  })

  it('honors an explicit positive limit', async () => {
    const { GET } = await import('./route')

    await GET(request('https://trackd.test/api/jobs?limit=25'))

    expect(mocks.jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
      }),
    )
  })
})

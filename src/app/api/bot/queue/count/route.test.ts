import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
  },
}))

describe('/api/bot/queue/count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.queryRaw.mockResolvedValue([{ count: BigInt(12) }])
  })

  it('returns the deduped saved bot queue count from a database aggregate', async () => {
    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ count: 12 })
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1)
  })

  it('does not query the queue count for anonymous users', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ count: 0, error: 'Unauthorized' })
    expect(mocks.queryRaw).not.toHaveBeenCalled()
  })
})

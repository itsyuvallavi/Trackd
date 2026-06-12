import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getBotQueueCount: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/cached-queries', () => ({
  getBotQueueCount: mocks.getBotQueueCount,
}))

describe('/api/bot/queue/count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_1' })
    mocks.getBotQueueCount.mockResolvedValue(12)
  })

  it('returns the cached deduped saved bot queue count', async () => {
    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ count: 12 })
    expect(mocks.getBotQueueCount).toHaveBeenCalledWith('user_1')
  })

  it('does not query the queue count for anonymous users', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const { GET } = await import('./route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ count: 0, error: 'Unauthorized' })
    expect(mocks.getBotQueueCount).not.toHaveBeenCalled()
  })
})

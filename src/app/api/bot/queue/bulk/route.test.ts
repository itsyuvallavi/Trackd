import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  markBotQueueJobApplied: vi.fn(),
  skipBotQueueJob: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/bot/queue-actions', async () => {
  class BotQueueActionError extends Error {
    constructor(
      message: string,
      readonly code: 'not_found' | 'duplicate',
      readonly status = code === 'duplicate' ? 409 : 404,
      readonly existingId?: string,
    ) {
      super(message)
      this.name = 'BotQueueActionError'
    }
  }

  return {
    BotQueueActionError,
    markBotQueueJobApplied: mocks.markBotQueueJobApplied,
    skipBotQueueJob: mocks.skipBotQueueJob,
  }
})

describe('/api/bot/queue/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'user_1' })
    mocks.markBotQueueJobApplied.mockResolvedValue({ id: 'job_1', status: 'APPLIED' })
    mocks.skipBotQueueJob.mockResolvedValue(undefined)
  })

  function bulkRequest(body: unknown) {
    return new NextRequest('https://trackd.test/api/bot/queue/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('marks selected jobs as applied and deduplicates submitted ids', async () => {
    const { POST } = await import('./route')

    const response = await POST(bulkRequest({ action: 'apply', jobIds: ['job_1', 'job_1', 'job_2'] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.markBotQueueJobApplied).toHaveBeenCalledTimes(2)
    expect(mocks.markBotQueueJobApplied).toHaveBeenNthCalledWith(1, 'user_1', 'job_1')
    expect(mocks.markBotQueueJobApplied).toHaveBeenNthCalledWith(2, 'user_1', 'job_2')
    expect(body).toMatchObject({
      success: true,
      action: 'apply',
      succeeded: ['job_1', 'job_2'],
      failed: [],
    })
  })

  it('keeps processing when one selected job fails', async () => {
    const { BotQueueActionError } = await import('@/lib/bot/queue-actions')
    mocks.markBotQueueJobApplied
      .mockResolvedValueOnce({ id: 'job_1', status: 'APPLIED' })
      .mockRejectedValueOnce(new BotQueueActionError('Already applied elsewhere', 'duplicate', 409, 'existing_1'))
      .mockResolvedValueOnce({ id: 'job_3', status: 'APPLIED' })

    const { POST } = await import('./route')

    const response = await POST(bulkRequest({ action: 'apply', jobIds: ['job_1', 'job_2', 'job_3'] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: false,
      succeeded: ['job_1', 'job_3'],
      failed: [
        {
          jobId: 'job_2',
          error: 'Already applied elsewhere',
          code: 'duplicate',
          existingId: 'existing_1',
        },
      ],
    })
  })

  it('skips selected jobs', async () => {
    const { POST } = await import('./route')

    const response = await POST(bulkRequest({ action: 'skip', jobIds: ['job_1', 'job_2'] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.skipBotQueueJob).toHaveBeenCalledTimes(2)
    expect(mocks.skipBotQueueJob).toHaveBeenNthCalledWith(1, 'user_1', 'job_1')
    expect(mocks.skipBotQueueJob).toHaveBeenNthCalledWith(2, 'user_1', 'job_2')
    expect(body.succeeded).toEqual(['job_1', 'job_2'])
  })

  it('rejects invalid bulk requests', async () => {
    const { POST } = await import('./route')

    const invalidAction = await POST(bulkRequest({ action: 'delete', jobIds: ['job_1'] }))
    const missingIds = await POST(bulkRequest({ action: 'skip', jobIds: [] }))

    expect(invalidAction.status).toBe(400)
    expect(missingIds.status).toBe(400)
  })
})

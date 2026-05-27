import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobStatus } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  job: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}))

const cacheMock = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('next/cache', () => ({
  revalidateTag: cacheMock.revalidateTag,
}))

import { skipBotQueueJob } from './queue-actions'

describe('bot queue actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.job.findFirst.mockResolvedValue({
      id: 'job_1',
      status: JobStatus.SAVED,
      tags: ['bot-approved', 'remote'],
    })
    prismaMock.job.update.mockResolvedValue({ id: 'job_1' })
  })

  it('archives skipped bot jobs instead of leaving them saved', async () => {
    await skipBotQueueJob('user_1', 'job_1')

    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: 'job_1' },
      data: {
        status: 'ARCHIVED',
        tags: { set: ['remote', 'bot-skipped'] },
        activities: {
          create: {
            userId: 'user_1',
            type: 'STATUS_CHANGE',
            fromStatus: JobStatus.SAVED,
            toStatus: 'ARCHIVED',
            description: 'Skipped from Bot Queue',
          },
        },
      },
    })
    expect(cacheMock.revalidateTag).toHaveBeenCalledWith('user:user_1:jobs', { expire: 0 })
    expect(cacheMock.revalidateTag).toHaveBeenCalledWith('user:user_1:bot', { expire: 0 })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailType } from './email-classifier'
import { JobStatus } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  notificationFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: mocks.notificationFindMany,
      create: mocks.notificationCreate,
      update: mocks.notificationUpdate,
    },
  },
}))

import { NotificationService } from './notification-service'

describe('notification service idempotency', () => {
  const email = {
    id: '<message-1@example.com>',
    from: 'recruiting@example.com',
    to: 'me@example.com',
    subject: 'Interview invitation',
    date: new Date('2026-05-15T08:00:00.000Z'),
    textBody: 'Interview invite',
    htmlBody: '',
  }
  const classified = {
    type: EmailType.INTERVIEW_INVITE,
    confidence: 90,
    suggestedStatus: JobStatus.INTERVIEW,
    jobInfo: { company: 'Acme', title: 'Engineer' },
    metadata: { keywords: [] },
  }

  beforeEach(() => {
    mocks.notificationFindMany.mockReset()
    mocks.notificationCreate.mockReset()
    mocks.notificationUpdate.mockReset()
  })

  it('does not create a duplicate new-job notification for the same email', async () => {
    mocks.notificationFindMany.mockResolvedValue([
      {
        id: 'existing-notification',
        metadata: { emailIdentifier: '<message-1@example.com>' },
      },
    ])

    await new NotificationService().createNewJobDetectedNotification(
      'user_123',
      email,
      classified,
      { company: 'Acme', title: 'Engineer' },
    )

    expect(mocks.notificationCreate).not.toHaveBeenCalled()
  })

  it('stores a stable email identifier on new-job notifications', async () => {
    mocks.notificationFindMany.mockResolvedValue([])
    mocks.notificationCreate.mockResolvedValue({ id: 'new-notification' })

    await new NotificationService().createNewJobDetectedNotification(
      'user_123',
      email,
      classified,
      { company: 'Acme', title: 'Engineer' },
    )

    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            emailIdentifier: '<message-1@example.com>',
          }),
        }),
      }),
    )
  })
})

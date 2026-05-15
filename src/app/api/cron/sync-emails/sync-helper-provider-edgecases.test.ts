import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailProvider, JobStatus } from '@prisma/client'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import type { EmailMessage } from '@/lib/email-service'
import { fetchEmailsSinceForIntegration } from '@/lib/fetch-emails-integration'
import { syncEmailsForUser } from './sync-helper'

const prismaMock = vi.hoisted(() => ({
  emailIntegration: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  job: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  activity: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  emailSyncLog: {
    create: vi.fn(),
  },
}))

const fetchEmailsSinceForIntegrationMock = vi.hoisted(() => vi.fn())

const notificationMocks = vi.hoisted(() => ({
  createAmbiguousMatchNotification: vi.fn(),
  createNewJobDetectedNotification: vi.fn(),
  createNoMatchNotification: vi.fn(),
  createSyncCompleteNotification: vi.fn(),
  createSyncErrorNotification: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/fetch-emails-integration', () => ({
  fetchEmailsSinceForIntegration: fetchEmailsSinceForIntegrationMock,
  MAX_OAUTH_MESSAGES: 3,
}))

vi.mock('@/lib/notification-service', () => ({
  NotificationService: vi.fn(function NotificationService() {
    return notificationMocks
  }),
}))

vi.mock('@/lib/ai-email-classifier', () => ({
  AIClassifier: vi.fn(),
}))

vi.mock('@/lib/ai-job-matcher', () => ({
  AIJobMatcher: vi.fn(),
}))

const previousCursor = new Date('2026-05-14T08:00:00.000Z')
const completedAt = new Date('2026-05-15T12:00:00.000Z')

function activeIntegration() {
  return {
    userId: 'user-1',
    provider: EmailProvider.GMAIL_OAUTH,
    isActive: true,
    lastSyncedAt: previousCursor,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenExpiry: new Date('2026-05-15T13:00:00.000Z'),
  }
}

function emailMessage(id: string, subject = 'Application received'): EmailMessage {
  return {
    id,
    from: 'recruiting@example.com',
    to: 'candidate@example.com',
    subject,
    date: new Date('2026-05-14T09:00:00.000Z'),
    textBody: 'Thanks for applying.',
    htmlBody: '',
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(completedAt)

  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  prismaMock.emailIntegration.findUnique.mockResolvedValue(activeIntegration())
  prismaMock.emailIntegration.update.mockResolvedValue(activeIntegration())
  prismaMock.job.findMany.mockResolvedValue([])
  prismaMock.job.update.mockResolvedValue({})
  prismaMock.activity.findMany.mockResolvedValue([])
  prismaMock.activity.create.mockResolvedValue({})
  prismaMock.emailSyncLog.create.mockResolvedValue({})

  notificationMocks.createAmbiguousMatchNotification.mockResolvedValue('notification-1')
  notificationMocks.createNewJobDetectedNotification.mockResolvedValue(undefined)
  notificationMocks.createNoMatchNotification.mockResolvedValue(undefined)
  notificationMocks.createSyncCompleteNotification.mockResolvedValue(undefined)
  notificationMocks.createSyncErrorNotification.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('syncEmailsForUser provider edge cases', () => {
  it('does not advance lastSyncedAt when the provider fetch cap is reached', async () => {
    fetchEmailsSinceForIntegrationMock.mockResolvedValue([
      emailMessage('gmail:1'),
      emailMessage('gmail:2'),
      emailMessage('gmail:3'),
    ])
    vi.spyOn(EmailClassifier.prototype, 'classify').mockReturnValue({
      type: EmailType.OTHER,
      confidence: 0,
      metadata: { keywords: [] },
    })

    const result = await syncEmailsForUser('user-1')

    expect(result).toMatchObject({
      success: true,
      stats: {
        totalEmails: 3,
        partial: true,
        processingErrors: 0,
      },
    })
    expect(fetchEmailsSinceForIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.any(Date),
    )
    expect(prismaMock.emailIntegration.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        lastSyncedAt: previousCursor,
        lastError: 'Partial sync: hit 3 email fetch cap',
      },
    })
    expect(prismaMock.emailSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        success: true,
        details: expect.objectContaining({
          partial: true,
          processingErrors: 0,
          reachedFetchCap: true,
        }),
      }),
    })
  })

  it('keeps the cursor pinned and records a partial run when one message fails processing', async () => {
    fetchEmailsSinceForIntegrationMock.mockResolvedValue([
      emailMessage('gmail:bad', 'Bad provider payload'),
      emailMessage('gmail:ok', 'Regular newsletter'),
    ])
    vi.spyOn(EmailClassifier.prototype, 'classify').mockImplementation((email) => {
      if (email.id === 'gmail:bad') {
        throw new Error('classifier failed on malformed message')
      }

      return {
        type: EmailType.OTHER,
        confidence: 0,
        metadata: { keywords: [] },
      }
    })

    const result = await syncEmailsForUser('user-1')

    expect(result).toMatchObject({
      success: true,
      stats: {
        totalEmails: 2,
        skippedEmails: 1,
        partial: true,
        processingErrors: 1,
      },
    })
    expect(prismaMock.emailIntegration.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        lastSyncedAt: previousCursor,
        lastError: 'Partial sync: 1 email processing error(s)',
      },
    })
    expect(prismaMock.emailSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        success: true,
        details: expect.objectContaining({
          partial: true,
          processingErrors: 1,
          reachedFetchCap: false,
        }),
      }),
    })
    expect(notificationMocks.createSyncCompleteNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        partial: true,
        processingErrors: 1,
      }),
      [],
    )
  })

  it('does not duplicate updates for an email already recorded in activity metadata', async () => {
    const email = emailMessage('<message-1@example.com>', 'Application received')
    fetchEmailsSinceForIntegrationMock.mockResolvedValue([email])
    prismaMock.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Frontend Engineer',
        company: 'Acme',
        url: null,
        status: JobStatus.SAVED,
        contactEmail: null,
        contactName: null,
        location: 'Remote',
      },
    ])
    prismaMock.activity.findMany.mockResolvedValue([
      {
        metadata: {
          emailIdentifier: '<message-1@example.com>',
        },
      },
    ])
    vi.spyOn(EmailClassifier.prototype, 'classify').mockReturnValue({
      type: EmailType.APPLICATION_CONFIRMATION,
      confidence: 95,
      jobInfo: {
        company: 'Acme',
        title: 'Frontend Engineer',
      },
      suggestedStatus: JobStatus.APPLIED,
      metadata: { keywords: ['application'] },
    })

    const result = await syncEmailsForUser('user-1')

    expect(result).toMatchObject({
      success: true,
      stats: {
        totalEmails: 1,
        processedEmails: 1,
        updatedJobs: 0,
        partial: false,
        processingErrors: 0,
      },
    })
    expect(prismaMock.job.update).not.toHaveBeenCalled()
    expect(prismaMock.activity.create).not.toHaveBeenCalled()
    expect(prismaMock.emailIntegration.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        lastSyncedAt: completedAt,
        lastError: null,
      },
    })
  })
})

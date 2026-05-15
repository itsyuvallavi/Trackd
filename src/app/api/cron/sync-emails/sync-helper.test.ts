import { describe, expect, it, vi } from 'vitest'
import { JobStatus } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}))

vi.mock('@/lib/fetch-emails-integration', () => ({
  fetchEmailsSinceForIntegration: vi.fn(),
}))

vi.mock('@/lib/ai-email-classifier', () => ({
  AIClassifier: vi.fn(),
}))

vi.mock('@/lib/ai-job-matcher', () => ({
  AIJobMatcher: vi.fn(),
}))

import { createEmailIdentifier, shouldUpdateStatus } from './sync-helper'

describe('email sync helper safeguards', () => {
  it('uses RFC message ids as the stable duplicate key', () => {
    expect(
      createEmailIdentifier({
        id: '<message-1@example.com>',
        subject: 'Thank you for applying',
        from: 'jobs@example.com',
        date: new Date('2026-05-15T08:30:00.000Z'),
      }),
    ).toBe('<message-1@example.com>')
  })

  it('uses stable provider ids when RFC message ids are unavailable', () => {
    expect(
      createEmailIdentifier({
        id: 'gmail:abc123',
        subject: 'Interview invitation',
        from: 'recruiting@example.com',
        date: new Date('2026-05-15T08:30:00.000Z'),
      }),
    ).toBe('gmail:abc123')
  })

  it('falls back to a same-day subject/from hash when ids are unstable', () => {
    const morning = createEmailIdentifier({
      id: 'Date.now():abc123',
      subject: 'Interview invitation',
      from: 'recruiting@example.com',
      date: new Date('2026-05-15T08:30:00.000Z'),
    })
    const evening = createEmailIdentifier({
      id: 'Date.now():def456',
      subject: 'Interview invitation',
      from: 'recruiting@example.com',
      date: new Date('2026-05-15T18:30:00.000Z'),
    })
    const nextDay = createEmailIdentifier({
      id: 'Date.now():def456',
      subject: 'Interview invitation',
      from: 'recruiting@example.com',
      date: new Date('2026-05-16T08:30:00.000Z'),
    })

    expect(morning).toBe(evening)
    expect(morning).not.toBe(nextDay)
  })

  it('only advances statuses except terminal rejection handling', () => {
    expect(shouldUpdateStatus(JobStatus.SAVED, JobStatus.APPLIED)).toBe(true)
    expect(shouldUpdateStatus(JobStatus.INTERVIEW, JobStatus.APPLIED)).toBe(false)
    expect(shouldUpdateStatus(JobStatus.OFFER, JobStatus.REJECTED)).toBe(true)
    expect(shouldUpdateStatus(JobStatus.ARCHIVED, JobStatus.APPLIED)).toBe(false)
    expect(shouldUpdateStatus(undefined, JobStatus.APPLIED)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { buildEmailSyncCursorUpdate } from './email-sync-cursor'

describe('email sync cursor', () => {
  const previousCursor = new Date('2026-05-14T08:00:00.000Z')
  const completedAt = new Date('2026-05-15T08:00:00.000Z')

  it('advances after a complete run', () => {
    expect(
      buildEmailSyncCursorUpdate({
        currentLastSyncedAt: previousCursor,
        fetchedEmailsCount: 10,
        maxFetchedEmails: 400,
        processingErrorsCount: 0,
        completedAt,
      }),
    ).toEqual({
      reachedFetchCap: false,
      completedFullWindow: true,
      nextLastSyncedAt: completedAt,
      lastError: null,
    })
  })

  it('does not advance when per-email processing failed', () => {
    expect(
      buildEmailSyncCursorUpdate({
        currentLastSyncedAt: previousCursor,
        fetchedEmailsCount: 10,
        maxFetchedEmails: 400,
        processingErrorsCount: 1,
        completedAt,
      }),
    ).toEqual({
      reachedFetchCap: false,
      completedFullWindow: false,
      nextLastSyncedAt: previousCursor,
      lastError: 'Partial sync: 1 email processing error(s)',
    })
  })

  it('does not advance when the provider fetch cap is reached', () => {
    expect(
      buildEmailSyncCursorUpdate({
        currentLastSyncedAt: previousCursor,
        fetchedEmailsCount: 400,
        maxFetchedEmails: 400,
        processingErrorsCount: 0,
        completedAt,
      }),
    ).toEqual({
      reachedFetchCap: true,
      completedFullWindow: false,
      nextLastSyncedAt: previousCursor,
      lastError: 'Partial sync: hit 400 email fetch cap',
    })
  })
})

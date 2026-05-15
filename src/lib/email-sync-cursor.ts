export function buildEmailSyncCursorUpdate(input: {
  currentLastSyncedAt: Date | null
  fetchedEmailsCount: number
  maxFetchedEmails: number
  processingErrorsCount: number
  completedAt?: Date
}): {
  reachedFetchCap: boolean
  completedFullWindow: boolean
  nextLastSyncedAt: Date | null
  lastError: string | null
} {
  const reachedFetchCap = input.fetchedEmailsCount >= input.maxFetchedEmails
  const completedFullWindow = !reachedFetchCap && input.processingErrorsCount === 0

  if (completedFullWindow) {
    return {
      reachedFetchCap,
      completedFullWindow,
      nextLastSyncedAt: input.completedAt ?? new Date(),
      lastError: null,
    }
  }

  return {
    reachedFetchCap,
    completedFullWindow,
    nextLastSyncedAt: input.currentLastSyncedAt,
    lastError: `Partial sync: ${
      reachedFetchCap
        ? `hit ${input.maxFetchedEmails} email fetch cap`
        : `${input.processingErrorsCount} email processing error(s)`
    }`,
  }
}

import { createHash } from 'crypto'

/**
 * Create a stable identifier for an email to prevent duplicate processing.
 */
export function createEmailIdentifier(email: { id?: string; subject: string; from: string; date: Date }): string {
  if (email.id && !email.id.includes('Date.now()')) {
    return email.id
  }

  const dateStr = email.date.toISOString().split('T')[0]
  const hashInput = `${email.subject}|${email.from}|${dateStr}`
  return createHash('sha256').update(hashInput).digest('hex').substring(0, 32)
}

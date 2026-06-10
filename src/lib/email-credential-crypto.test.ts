import { describe, expect, it } from 'vitest'
import {
  decryptEmailCredential,
  encryptEmailCredential,
  isEncryptedEmailCredential,
} from './email-credential-crypto'

const env = {
  NODE_ENV: 'production',
  EMAIL_CREDENTIAL_ENCRYPTION_KEY: 'test-email-credential-key',
} as const

describe('email credential encryption', () => {
  it('encrypts and decrypts credentials without exposing plaintext', () => {
    const encrypted = encryptEmailCredential('imap-secret-password', env)

    expect(encrypted).not.toContain('imap-secret-password')
    expect(isEncryptedEmailCredential(encrypted)).toBe(true)
    expect(decryptEmailCredential(encrypted, env)).toBe('imap-secret-password')
  })

  it('keeps legacy plaintext readable during migration', () => {
    expect(decryptEmailCredential('legacy-password', env)).toBe('legacy-password')
  })

  it('does not double-encrypt stored encrypted values', () => {
    const encrypted = encryptEmailCredential('refresh-token', env)

    expect(encryptEmailCredential(encrypted, env)).toBe(encrypted)
  })

  it('decrypts credentials encrypted with an older fallback secret after a primary key is added', () => {
    const encryptedWithFallback = encryptEmailCredential('imap-password', {
      NODE_ENV: 'production',
      SUPABASE_SERVICE_ROLE_KEY: 'old-fallback-secret',
    })

    expect(
      decryptEmailCredential(encryptedWithFallback, {
        NODE_ENV: 'production',
        EMAIL_CREDENTIAL_ENCRYPTION_KEY: 'new-primary-secret',
        SUPABASE_SERVICE_ROLE_KEY: 'old-fallback-secret',
      }),
    ).toBe('imap-password')
  })
})

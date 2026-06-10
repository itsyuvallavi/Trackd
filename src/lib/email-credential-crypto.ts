import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ENCRYPTED_PREFIX = 'enc:v1:'
const IV_BYTES = 12
const TAG_BYTES = 16

type CredentialEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | 'EMAIL_CREDENTIAL_ENCRYPTION_KEY'
    | 'EMAIL_OAUTH_STATE_SECRET'
    | 'SUPABASE_SERVICE_ROLE_KEY'
    | 'NODE_ENV'
  >
>

function resolveCredentialSecrets(env: CredentialEnv = process.env): string[] {
  return [
    env.EMAIL_CREDENTIAL_ENCRYPTION_KEY?.trim(),
    env.EMAIL_OAUTH_STATE_SECRET?.trim(),
    env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  ].filter((secret): secret is string => Boolean(secret))
}

function resolvePrimaryCredentialSecret(env: CredentialEnv = process.env): string | null {
  return resolveCredentialSecrets(env)[0] ?? null
}

function encryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function isEncryptedEmailCredential(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)
}

export function encryptEmailCredential(
  value: string | null | undefined,
  env: CredentialEnv = process.env,
): string | null {
  if (!value) return null
  if (isEncryptedEmailCredential(value)) return value

  const secret = resolvePrimaryCredentialSecret(env)
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Email credential encryption key is not configured')
    }

    return value
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv, {
    authTagLength: TAG_BYTES,
  })
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${tag.toString(
    'base64url',
  )}.${ciphertext.toString('base64url')}`
}

export function decryptEmailCredential(
  value: string | null | undefined,
  env: CredentialEnv = process.env,
): string | null {
  if (!value) return null
  if (!isEncryptedEmailCredential(value)) return value

  const secrets = resolveCredentialSecrets(env)
  if (secrets.length === 0) {
    throw new Error('Email credential encryption key is not configured')
  }

  const encoded = value.slice(ENCRYPTED_PREFIX.length)
  const [ivRaw, tagRaw, ciphertextRaw] = encoded.split('.')
  if (!ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error('Encrypted email credential is malformed')
  }

  let lastError: unknown
  for (const secret of secrets) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        encryptionKey(secret),
        Buffer.from(ivRaw, 'base64url'),
        { authTagLength: TAG_BYTES },
      )
      decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))

      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
        decipher.final(),
      ]).toString('utf8')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to decrypt email credential')
}

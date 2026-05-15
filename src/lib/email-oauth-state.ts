import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export type EmailOAuthProvider = 'google' | 'microsoft'

export type EmailOAuthStatePayload = {
  v: 1
  provider: EmailOAuthProvider
  redirectTo: string
  userId: string
  nonce: string
  iat: number
  exp: number
}

type StateEnv = Partial<Pick<
  NodeJS.ProcessEnv,
  'EMAIL_OAUTH_STATE_SECRET' | 'CRON_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY' | 'NODE_ENV'
>>

const DEFAULT_REDIRECT_PATH = '/settings/integrations'
const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000
const DEV_STATE_SECRET = 'trackd-email-oauth-state-development-secret'
const LOCAL_REDIRECT_BASE = 'https://trackd.local'

export function safeEmailOAuthRedirectPath(
  rawPath: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH,
): string {
  const value = rawPath?.trim()

  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  try {
    const base = new URL(LOCAL_REDIRECT_BASE)
    const url = new URL(value, base)

    if (url.origin !== base.origin) {
      return fallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function resolveEmailOAuthStateSecret(env: StateEnv = process.env): string | null {
  const secret =
    env.EMAIL_OAUTH_STATE_SECRET?.trim() ||
    env.CRON_SECRET?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (secret) {
    return secret
  }

  if (env.NODE_ENV === 'production') {
    return null
  }

  return DEV_STATE_SECRET
}

export function createEmailOAuthState(
  input: {
    provider: EmailOAuthProvider
    redirectTo?: string | null
    userId: string
  },
  options: {
    secret?: string | null
    nowMs?: number
    ttlMs?: number
    nonce?: string
  } = {},
): string {
  const secret = options.secret ?? resolveEmailOAuthStateSecret()

  if (!secret) {
    throw new Error('Email OAuth state secret is not configured')
  }

  const nowMs = options.nowMs ?? Date.now()
  const payload: EmailOAuthStatePayload = {
    v: 1,
    provider: input.provider,
    redirectTo: safeEmailOAuthRedirectPath(input.redirectTo),
    userId: input.userId,
    nonce: options.nonce ?? randomBytes(16).toString('base64url'),
    iat: nowMs,
    exp: nowMs + (options.ttlMs ?? DEFAULT_STATE_TTL_MS),
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = signState(encodedPayload, secret)

  return `${encodedPayload}.${signature}`
}

export function verifyEmailOAuthState(
  state: string | null | undefined,
  options: {
    secret?: string | null
    nowMs?: number
  } = {},
):
  | { ok: true; payload: EmailOAuthStatePayload }
  | { ok: false; error: 'missing_state' | 'invalid_state' | 'state_secret_missing' | 'expired_state' } {
  if (!state) {
    return { ok: false, error: 'missing_state' }
  }

  const secret = options.secret ?? resolveEmailOAuthStateSecret()

  if (!secret) {
    return { ok: false, error: 'state_secret_missing' }
  }

  const [encodedPayload, signature, extra] = state.split('.')

  if (!encodedPayload || !signature || extra !== undefined) {
    return { ok: false, error: 'invalid_state' }
  }

  if (!hasValidSignature(encodedPayload, signature, secret)) {
    return { ok: false, error: 'invalid_state' }
  }

  let payload: EmailOAuthStatePayload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'invalid_state' }
  }

  if (
    payload.v !== 1 ||
    !['google', 'microsoft'].includes(payload.provider) ||
    typeof payload.userId !== 'string' ||
    !payload.userId ||
    typeof payload.nonce !== 'string' ||
    !payload.nonce ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, error: 'invalid_state' }
  }

  if (payload.exp < (options.nowMs ?? Date.now())) {
    return { ok: false, error: 'expired_state' }
  }

  return {
    ok: true,
    payload: {
      ...payload,
      redirectTo: safeEmailOAuthRedirectPath(payload.redirectTo),
    },
  }
}

function signState(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function hasValidSignature(encodedPayload: string, signature: string, secret: string): boolean {
  const expected = signState(encodedPayload, secret)
  const expectedBuffer = Buffer.from(expected, 'base64url')
  const actualBuffer = Buffer.from(signature, 'base64url')

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

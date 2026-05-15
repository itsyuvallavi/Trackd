const DEFAULT_AUTH_REDIRECT = '/jobs'
const LOCAL_REDIRECT_BASE = 'https://trackd.local'

export function safeAuthRedirectPath(
  rawPath: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
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

export function postAuthRedirectPath(input: {
  next: string | null | undefined
  hasCompletedOnboarding: boolean
}): string {
  return input.hasCompletedOnboarding ? safeAuthRedirectPath(input.next) : '/onboarding'
}

export function authErrorMessage(errorCode: string | null | undefined): string | null {
  switch (errorCode) {
    case 'missing_code':
      return 'Google did not return an auth code. Please try signing in again.'
    case 'auth_not_configured':
      return 'Authentication is not configured on the server.'
    case 'auth_failed':
      return 'Google sign-in failed. Please try again.'
    case 'profile_setup_failed':
      return 'Your Google account connected, but Trackd could not finish setting up your profile. Please try again.'
    default:
      return null
  }
}

export function profileFieldsFromAuthUser(input: {
  id: string
  email?: string | null
  metadata?: Record<string, unknown> | null
}): {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
} {
  if (!input.email) {
    throw new Error('Auth user is missing an email address')
  }

  return {
    id: input.id,
    email: input.email,
    name:
      stringMetadata(input.metadata, 'full_name') ??
      stringMetadata(input.metadata, 'name') ??
      stringMetadata(input.metadata, 'display_name'),
    avatarUrl: stringMetadata(input.metadata, 'avatar_url'),
  }
}

function stringMetadata(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

const DEV_ADMIN_EMAIL = 'info@yuvallavi.com'

export function getAdminEmail(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.ADMIN_EMAIL?.trim()
  if (configured) return configured

  return env.NODE_ENV === 'production' ? null : DEV_ADMIN_EMAIL
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = getAdminEmail()
  return Boolean(adminEmail && email === adminEmail)
}

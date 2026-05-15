#!/usr/bin/env tsx

import './load-env'

type Check = {
  label: string
  ok: boolean
  detail: string
}

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function safeOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null
  try {
    return new URL(value.trim()).origin
  } catch {
    return null
  }
}

function redactedPresence(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) return 'missing'
  return `set (${value.length} chars)`
}

function printCheck(check: Check) {
  const mark = check.ok ? 'OK' : 'FAIL'
  console.log(`${mark.padEnd(4)} ${check.label}: ${check.detail}`)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseOrigin = safeOrigin(supabaseUrl)
const appOrigin = safeOrigin(process.env.NEXT_PUBLIC_APP_URL)
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()

const checks: Check[] = [
  {
    label: 'NEXT_PUBLIC_SUPABASE_URL',
    ok: Boolean(supabaseOrigin),
    detail: supabaseOrigin ?? 'missing or invalid URL',
  },
  {
    label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ok: present('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    detail: redactedPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  },
  {
    label: 'DATABASE_URL',
    ok: present('DATABASE_URL'),
    detail: redactedPresence('DATABASE_URL'),
  },
  {
    label: 'NEXT_PUBLIC_APP_URL',
    ok: Boolean(appOrigin),
    detail: appOrigin ?? 'missing or invalid URL',
  },
  {
    label: 'GOOGLE_CLIENT_ID format',
    ok: Boolean(googleClientId?.endsWith('.apps.googleusercontent.com')),
    detail: googleClientId ? 'set and looks like a Google OAuth client ID' : 'missing',
  },
]

console.log('Google signup auth config check')
console.log('No secret values are printed.\n')

for (const check of checks) {
  printCheck(check)
}

console.log('\nDashboard values to verify manually:')
if (supabaseOrigin) {
  console.log(`- Google Cloud authorized redirect URI: ${supabaseOrigin}/auth/v1/callback`)
} else {
  console.log('- Google Cloud authorized redirect URI: cannot compute until NEXT_PUBLIC_SUPABASE_URL is valid')
}

if (appOrigin) {
  console.log(`- Supabase Site URL: ${appOrigin}`)
  console.log(`- Supabase Additional Redirect URL: ${appOrigin}/auth/callback`)
} else {
  console.log('- Supabase Site URL / Additional Redirect URLs: cannot compute until NEXT_PUBLIC_APP_URL is valid')
}

console.log('- Supabase Auth Providers: Google enabled with the same Google OAuth web client')
console.log('- Supabase Auth URL config: include production, preview, and localhost callback origins you actually use')

const failed = checks.filter((check) => !check.ok)
if (failed.length > 0) {
  console.error(`\n${failed.length} local config check(s) failed.`)
  process.exit(1)
}

console.log('\nLocal config checks passed. Manual dashboard checks are still required.')

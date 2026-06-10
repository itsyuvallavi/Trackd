#!/usr/bin/env tsx

const required = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'OPENAI_API_KEY',
  'EMAIL_OAUTH_STATE_SECRET',
  'EMAIL_CREDENTIAL_ENCRYPTION_KEY',
  'CRON_SECRET',
  'ADMIN_EMAIL',
] as const

const recommended = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'JOBS_SEARCH_API_KEY',
] as const

function check(names: readonly string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim())
}

const missingRequired = check(required)
const missingRecommended = check(recommended)

console.log('Trackd beta environment check\n')

if (missingRequired.length === 0) {
  console.log('Required: all set')
} else {
  console.log('Required missing:')
  for (const name of missingRequired) {
    console.log(`  - ${name}`)
  }
}

if (missingRecommended.length === 0) {
  console.log('Recommended: all set')
} else {
  console.log('Recommended missing:')
  for (const name of missingRecommended) {
    console.log(`  - ${name}`)
  }
}

console.log('\nNotes:')
console.log('- Set CRON_SECRET on Vercel so Vercel Cron sends Authorization: Bearer automatically')
console.log('- GitHub Actions sync-emails workflow must use the same CRON_SECRET')
console.log('- Add beta tester emails as Google OAuth test users until the app is published')

if (missingRequired.length > 0) {
  process.exit(1)
}

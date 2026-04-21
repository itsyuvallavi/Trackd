#!/usr/bin/env bun
/**
 * Run the same auto-apply pipeline as production (Browserless + orchestrator).
 *
 * Usage:
 *   bun run scripts/test-auto-apply-local.ts --user-id=<uuid> --job-id=<uuid>
 *   bun run scripts/test-auto-apply-local.ts --user-id=<uuid>   # uses latest job with a URL for that user
 *
 * Fill only (default — does not submit):
 *   bun run scripts/test-auto-apply-local.ts --user-id=...
 *
 * Actually submit to the employer (refills form + clicks submit — use only on test postings):
 *   bun run scripts/test-auto-apply-local.ts --user-id=... --job-id=... --submit-real
 *
 * Requires: DATABASE_URL, OPENAI_API_KEY, and either BROWSERLESS_API_KEY (or BROWSERLESS_TOKEN) or BROWSER_APPLY_CHROME_LOCAL=1
 */

import { prisma } from '../src/lib/prisma'
import { detectATS } from '../src/lib/bot/ats-detector'
import { isApplyBrowserConfigured } from '../src/lib/bot/apply/browser'
import {
  runApplicationFill,
  runApplicationSubmit,
} from '../src/lib/bot/apply/apply-orchestrator'

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`${name}=`))
  return p?.slice(name.length + 1)
}

const userId = arg('--user-id')
const jobIdArg = arg('--job-id')
const submitReal = process.argv.includes('--submit-real')

async function main(): Promise<number> {
  if (!isApplyBrowserConfigured()) {
    console.error('Missing browser: set BROWSERLESS_API_KEY / BROWSERLESS_TOKEN or BROWSER_APPLY_CHROME_LOCAL=1')
    return 1
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY')
    return 1
  }
  if (!userId) {
    console.error('Pass --user-id=<your auth user id (same as Job.userId)>')
    return 1
  }

  let jobId = jobIdArg
  if (!jobId) {
    const j = await prisma.job.findFirst({
      where: { userId, url: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, company: true, url: true },
    })
    if (!j?.url) {
      console.error('No job with URL for this user. Pass --job-id=...')
      return 1
    }
    jobId = j.id
    console.log(`Using latest job: ${j.title} @ ${j.company}\n${j.url}\n`)
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true, title: true, company: true, url: true },
  })
  if (!job?.url) {
    console.error('Job not found or has no URL')
    return 1
  }

  const atsType = detectATS(job.url)
  console.log(`ATS: ${atsType}\n`)

  const attempt = await prisma.applicationAttempt.create({
    data: {
      userId,
      jobId: job.id,
      atsType,
      status: 'filling',
    },
  })

  console.log(`Attempt ${attempt.id} — running fill…\n`)
  const fill = await runApplicationFill(attempt.id, userId, job.id)

  console.log('Fill result:', JSON.stringify(fill, null, 2))

  if (!fill.success) {
    return 1
  }

  if (!submitReal) {
    console.log(
      '\nFill only. To run real submit (refill + click Send/Apply), add --submit-real (dangerous on real jobs).'
    )
    return 0
  }

  console.log('\n--submit-real: running submit step…\n')
  const sub = await runApplicationSubmit(attempt.id, userId, job.id)
  console.log('Submit result:', JSON.stringify(sub, null, 2))

  const final = await prisma.applicationAttempt.findUnique({ where: { id: attempt.id } })
  console.log('\nFinal attempt:', final?.status, final?.errorMessage ?? '')

  return sub.success ? 0 : 1
}

const code = await main().catch((e) => {
  console.error(e)
  return 1
})
await prisma.$disconnect().catch(() => {})
process.exit(code)

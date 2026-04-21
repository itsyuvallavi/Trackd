#!/usr/bin/env bun
/**
 * Report how many bot-saved jobs look US-based vs elsewhere (heuristic).
 * Optionally delete bot jobs for one user if a US majority is detected.
 *
 * Usage:
 *   bun run scripts/bot-jobs-us-report.ts <userId>
 *   bun run scripts/bot-jobs-us-report.ts <userId> --wipe-if-majority-us --confirm
 *   bun run scripts/bot-jobs-us-report.ts <userId> --wipe-all-bot --confirm
 *
 * <userId> is your Profile id (same as Supabase auth user id).
 *
 * Heuristics are imperfect: "Remote" alone is unknown; dice.com URLs count as likely US
 * (US-centric board). Review the printed samples before using --confirm.
 */

import { prisma } from '../src/lib/prisma'
import { JobSource } from '@prisma/client'

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'
    .split(/\s+/)
)

type Bucket = 'likely_us' | 'likely_non_us' | 'unknown'

function classifyJob(job: {
  location: string | null
  url: string | null
  salary: string | null
}): Bucket {
  const loc = (job.location ?? '').toLowerCase()
  const url = (job.url ?? '').toLowerCase()
  const sal = (job.salary ?? '').toLowerCase()
  const blob = `${loc} ${url} ${sal}`

  const hasUs =
    /\b(united states|usa\b|u\.s\.a\.?|u\.s\.|america)\b/.test(blob) ||
    /\bremote\s*[-–—,]\s*(us|usa|u\.s\.)\b/.test(blob) ||
    /\bus\s+remote\b/.test(blob) ||
    /\b(usd|\$\s*[0-9])/.test(sal) ||
    /\bdice\.com\b/.test(url)

  const stateTail = job.location?.match(/\b([A-Za-z]{2})\s*$/)
  if (stateTail && US_STATES.has(stateTail[1].toUpperCase())) {
    return 'likely_us'
  }

  const hasNonUs =
    /\b(united kingdom|uk\b|england|scotland|wales|ireland|germany|france|spain|italy|netherlands|sweden|norway|denmark|finland|poland|portugal|austria|switzerland|belgium|europe|eu\b|israel|canada|toronto|vancouver|montreal|australia|india|bangalore|hyderabad|singapore|japan|tokyo)\b/.test(
      blob
    )

  if (hasNonUs && !hasUs) return 'likely_non_us'
  if (hasUs && !hasNonUs) return 'likely_us'
  if (hasUs && hasNonUs) return 'unknown'
  if (/\bremote\b/.test(loc) && loc.length < 40) return 'unknown'
  return 'unknown'
}

function isMajorityUs(counts: Record<Bucket, number>): boolean {
  const classified = counts.likely_us + counts.likely_non_us
  if (classified === 0) return false
  return counts.likely_us > counts.likely_non_us && counts.likely_us / classified >= 0.55
}

async function wipeBotJobsForUser(userId: string, jobIds: string[]) {
  if (jobIds.length === 0) return { deletedJobs: 0, deletedAttempts: 0 }

  const delAttempts = await prisma.applicationAttempt.deleteMany({
    where: { userId, jobId: { in: jobIds } },
  })

  const delJobs = await prisma.job.deleteMany({
    where: { userId, id: { in: jobIds } },
  })

  return { deletedJobs: delJobs.count, deletedAttempts: delAttempts.count }
}

async function main() {
  const argv = process.argv.slice(2)
  const confirm = argv.includes('--confirm')
  const wipeIfMajority = argv.includes('--wipe-if-majority-us')
  const wipeAllBot = argv.includes('--wipe-all-bot')

  const userId = argv.find((a) => !a.startsWith('--'))
  if (!userId) {
    console.error(
      'Usage: bun run scripts/bot-jobs-us-report.ts <userId> [--wipe-if-majority-us|--wipe-all-bot] [--confirm]'
    )
    process.exit(1)
  }

  if ((wipeIfMajority || wipeAllBot) && !confirm) {
    console.error('Refusing to delete without --confirm')
    process.exit(1)
  }

  const jobs = await prisma.job.findMany({
    where: { userId, source: JobSource.BOT },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      url: true,
      salary: true,
      status: true,
      savedAt: true,
    },
    orderBy: { savedAt: 'desc' },
  })

  console.log(`\nBot-saved jobs for user ${userId}: ${jobs.length}\n`)

  if (jobs.length === 0) {
    console.log('Nothing to analyze.')
    process.exit(0)
  }

  const counts: Record<Bucket, number> = {
    likely_us: 0,
    likely_non_us: 0,
    unknown: 0,
  }

  const byBucket: Record<Bucket, typeof jobs> = {
    likely_us: [],
    likely_non_us: [],
    unknown: [],
  }

  for (const j of jobs) {
    const b = classifyJob(j)
    counts[b]++
    byBucket[b].push(j)
  }

  console.log('Heuristic counts:')
  console.log(`  likely US:     ${counts.likely_us}`)
  console.log(`  likely non-US: ${counts.likely_non_us}`)
  console.log(`  unknown:       ${counts.unknown}`)
  console.log(
    `\nMajority-US (among US vs non-US only, ≥55% US): ${isMajorityUs(counts) ? 'YES' : 'NO'}`
  )

  const printSamples = (label: string, list: typeof jobs, n = 8) => {
    console.log(`\n--- ${label} (up to ${n}) ---`)
    for (const j of list.slice(0, n)) {
      const u = j.url ? j.url.replace(/^https?:\/\//, '').slice(0, 72) : '(no url)'
      console.log(`  • ${j.title} @ ${j.company}`)
      console.log(`    loc: ${j.location ?? '—'} | ${u}`)
    }
  }

  printSamples('likely US', byBucket.likely_us)
  printSamples('likely non-US', byBucket.likely_non_us)
  printSamples('unknown', byBucket.unknown)

  if (!wipeIfMajority && !wipeAllBot) {
    console.log(
      '\nNo delete requested. Add --wipe-if-majority-us --confirm after reviewing, or --wipe-all-bot --confirm to delete all bot jobs for this user.'
    )
    process.exit(0)
  }

  let idsToDelete: string[]
  if (wipeAllBot) {
    idsToDelete = jobs.map((j) => j.id)
    console.log(`\n--wipe-all-bot: deleting ${idsToDelete.length} bot jobs.`)
  } else {
    if (!isMajorityUs(counts)) {
      console.log(
        '\nNot deleting: US is not a clear majority among classified rows. (Per your instruction to skip wipe if not mostly US.)'
      )
      process.exit(0)
    }
    idsToDelete = jobs.map((j) => j.id)
    console.log(
      `\n--wipe-if-majority-us: deleting ${idsToDelete.length} bot jobs (all BOT source for this user).`
    )
  }

  const { deletedJobs, deletedAttempts } = await wipeBotJobsForUser(userId, idsToDelete)
  console.log(`Done. Deleted jobs: ${deletedJobs}, application attempts: ${deletedAttempts}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

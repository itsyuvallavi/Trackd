#!/usr/bin/env bun

import './load-env'

/**
 * Integration test for the job search bot pipeline.
 *
 * Tests the full flow: BotConfig → search APIs → AI evaluator → DB save
 *
 * Usage:
 *   bun run scripts/test-bot-search.ts [--dry-run] [--one-location]
 *   bun run scripts/test-bot-search.ts --dry-run --save-snapshot          # search + save jobs to snapshot.json
 *   bun run scripts/test-bot-search.ts --dry-run --from-snapshot          # replay saved jobs, zero API calls
 *   bun run scripts/test-bot-search.ts --dry-run --from-snapshot=my.json  # replay from a named file
 *
 * --dry-run        Preview results without saving to DB
 * --save-snapshot  After search, write raw jobs to scripts/snapshot.json for later replay
 * --from-snapshot  Load jobs from scripts/snapshot.json instead of calling search APIs
 * --one-location   Pass a single location to runSearch (reduces API round-trips)
 * --sources=       Only run these backends (same as BOT_SEARCH_SOURCES)
 *
 * Required env — at least one backend (see `src/lib/bot/bot-search-sources.ts`):
 *   JSEARCH_API_KEY / JOBS_SEARCH_API_KEY   JSearch + Jobs Search API (shared RapidAPI key OK)
 *
 * Optional:
 *   OPENAI_API_KEY    Enable AI scoring (otherwise jobs are saved without score)
 */

import { prisma } from '../src/lib/prisma'
import { BotSearchFrequency } from '@prisma/client'
import { jobsSearchApiRapidApiKey } from '../src/lib/bot/rapidapi-jobs-search-keys'
import {
  botSearchHasQueryableBackend,
  botSearchSourceAllowed,
  botSearchSourcesAllowlist,
  effectiveSearchBackendLabels,
} from '../src/lib/bot/bot-search-sources'

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { SearchResponse } from '../src/lib/bot/types'

const isDryRun = process.argv.includes('--dry-run')
const oneLocation = process.argv.includes('--one-location')
const saveSnapshot = process.argv.includes('--save-snapshot')
const fromSnapshotArg = process.argv.find((a) => a === '--from-snapshot' || a.startsWith('--from-snapshot='))
const fromSnapshot = !!fromSnapshotArg
const snapshotFile = (() => {
  const dir = new URL('.', import.meta.url).pathname
  const eq = fromSnapshotArg?.split('=')[1]
  return eq ? resolve(eq) : resolve(dir, 'snapshot.json')
})()

const targetUserId = process.argv.find(
  (a) =>
    !a.startsWith('--') &&
    a !== process.argv[0] &&
    a !== process.argv[1] &&
    !a.includes('=')
)

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m'
const ok   = (m: string) => console.log(`${G}✓${X} ${m}`)
const warn = (m: string) => console.log(`${Y}⚠${X}  ${m}`)
const fail = (m: string) => console.log(`${R}✗${X} ${m}`)
const info = (m: string) => console.log(`${C}→${X} ${m}`)
const h    = (m: string) => console.log(`\n${B}${m}${X}`)

function explainSearchFailures(failed: Record<string, string>) {
  const blob = JSON.stringify(failed)
  if (/\b429\b|quota/i.test(blob)) {
    warn(
      'HTTP 429 / quota on at least one provider — upgrade RapidAPI plans or wait for reset; --one-location reduces requests.'
    )
  }
}

async function main() {
  h('🤖 Bot Search Integration Test')
  if (isDryRun) warn('DRY RUN — no jobs will be saved to DB\n')

  // ── 1. Check env ──────────────────────────────────────────────────────────
  h('Step 1: Environment check')

  const jSearchKey = process.env.JSEARCH_API_KEY
  const jobsSearchKey = process.env.JOBS_SEARCH_API_KEY?.trim()
  const effectiveJobsSearchKey = jobsSearchApiRapidApiKey()
  const openaiKey = process.env.OPENAI_API_KEY

  if (!botSearchHasQueryableBackend()) {
    fail('No search backends configured for this environment.')
    console.log('  Set JSEARCH_API_KEY and/or JOBS_SEARCH_API_KEY (Jobs Search API can reuse JSEARCH key).')
    process.exit(1)
  }
  const sourcesAllow = process.env.BOT_SEARCH_SOURCES?.trim()
  if (sourcesAllow) info(`BOT_SEARCH_SOURCES=${sourcesAllow} (only these backends will run)`)
  else info('BOT_SEARCH_SOURCES unset — all backends that have keys will run')

  h('Backends that WILL run (after allowlist + keys)')
  const effective = effectiveSearchBackendLabels()
  if (effective.length === 0) {
    warn('None — fix keys or BOT_SEARCH_SOURCES / --sources=')
  } else {
    for (const label of effective) ok(label)
  }

  const allow = botSearchSourcesAllowlist()
  h('Keys on disk (✓ green = selected backend will actually call this run)')
  if ((jSearchKey ?? '').trim()) {
    if (botSearchSourceAllowed(allow, 'jsearch'))
      ok('JSEARCH_API_KEY → JSearch will run this run')
    else info('JSEARCH_API_KEY present → not used this run (not in BOT_SEARCH_SOURCES / --sources)')
  } else if (botSearchSourceAllowed(allow, 'jsearch')) {
    warn('JSEARCH_API_KEY missing — jsearch was requested but cannot run')
  } else {
    info('JSEARCH_API_KEY not set (skipped for this allowlist)')
  }

  if (effectiveJobsSearchKey) {
    if (botSearchSourceAllowed(allow, 'jobs_search_api'))
      ok(
        jobsSearchKey
          ? 'JOBS_SEARCH_API_KEY → Jobs Search API will run this run'
          : 'JSEARCH_API_KEY → Jobs Search API will run this run (JOBS_SEARCH_API_KEY unset)'
      )
    else info('Jobs Search API key present → not used this run (not in allowlist)')
  } else if (botSearchSourceAllowed(allow, 'jobs_search_api')) {
    warn('No RapidAPI key for Jobs Search API — requested but cannot run')
  } else {
    info('Jobs Search API key not configured (skipped for this allowlist)')
  }

  if (!openaiKey) warn('OPENAI_API_KEY not set — AI scoring spot-check will be skipped')
  else ok('OPENAI_API_KEY set — AI scoring enabled for Step 4 spot-check')

  // ── 2. Resolve user + BotConfig ───────────────────────────────────────────
  h('Step 2: Resolve BotConfig')
  let userId = targetUserId

  if (!userId) {
    const config = await prisma.botConfig.findFirst({ orderBy: { createdAt: 'asc' } })
    if (config) {
      userId = config.userId
      info(`Found existing BotConfig for userId: ${userId}`)
    } else {
      const anyUser = await prisma.profile.findFirst({ select: { id: true, email: true } })
      if (!anyUser) {
        fail('No users in DB. Create an account in the app first.')
        process.exit(1)
      }
      userId = anyUser.id
      info(`No BotConfig found — using user: ${anyUser.email} (${anyUser.id})`)
    }
  }

  const botConfig = await prisma.botConfig.upsert({
    where: { userId },
    create: {
      userId,
      keywords: ['software engineer', 'frontend developer'],
      locations: ['Remote'],
      remoteOnly: false,
      isActive: true,
      searchFrequency: BotSearchFrequency.DAILY,
      minScore: 50,
    },
    update: {},
  })

  console.log(`  Keywords:      ${botConfig.keywords.join(', ')}`)
  const locationsForRun = (() => {
    const raw = botConfig.locations.length > 0 ? botConfig.locations : ['Remote']
    if (oneLocation) {
      const first = raw[0] ?? 'Remote'
      info(`--one-location: using "${first}" only (${raw.length} configured)`)
      return [first]
    }
    return raw
  })()

  console.log(`  Locations:     ${locationsForRun.join(', ')}${oneLocation ? ' (subset)' : ''}`)
  console.log(`  Remote only:   ${botConfig.remoteOnly ? 'yes' : 'no'}`)
  console.log(`  Experience:    ${botConfig.experienceLevel || 'any'}`)
  console.log(`  Languages:     ${(botConfig.spokenLanguages ?? []).join(', ') || '(none)'}`)
  console.log(`  Exclude cos:   ${botConfig.excludeCompanies.join(', ') || '(none)'}`)
  console.log(`  Exclude kws:   ${botConfig.excludeKeywords.join(', ') || '(none)'}`)
  console.log(`  MinScore:      ${botConfig.minScore}`)

  // ── 3. Run search (or load snapshot) ──────────────────────────────────────
  const previewResultsWanted = 45
  let searchResponse: SearchResponse

  if (fromSnapshot) {
    h('Step 3: Load jobs from snapshot (no API calls)')
    if (!existsSync(snapshotFile)) {
      fail(`Snapshot file not found: ${snapshotFile}`)
      info('Run without --from-snapshot first to capture a snapshot (add --save-snapshot).')
      process.exit(1)
    }
    searchResponse = JSON.parse(readFileSync(snapshotFile, 'utf-8'))
    ok(`Loaded ${searchResponse.jobs.length} jobs from ${snapshotFile}`)
    console.log(`  Platforms (from snapshot): ${searchResponse.meta.platforms_succeeded.join(', ') || 'none'}`)
    console.log(`  Total jobs in snapshot: ${searchResponse.jobs.length}`)
  } else {
    h('Step 3: Run search APIs')
    if (
      !sourcesAllow &&
      !oneLocation &&
      locationsForRun.length > 2 &&
      effective.length > 2
    ) {
      warn(
        `Many locations (${locationsForRun.length}) × backends (${effective.length}) can take several minutes — narrow with --sources=jsearch or --one-location`
      )
    }

    const { runSearch } = await import('../src/lib/bot/adapters/search-client')

    try {
      searchResponse = await runSearch({
        keywords: botConfig.keywords,
        locations: locationsForRun,
        remote_only: botConfig.remoteOnly,
        exclude_companies: botConfig.excludeCompanies,
        exclude_keywords: botConfig.excludeKeywords,
        results_wanted: previewResultsWanted,
        experience_level: botConfig.experienceLevel,
      })
    } catch (e) {
      fail(`Search failed: ${e instanceof Error ? e.message : String(e)}`)
      process.exit(1)
    }

    if (saveSnapshot) {
      writeFileSync(snapshotFile, JSON.stringify(searchResponse, null, 2))
      ok(`Snapshot saved → ${snapshotFile}`)
    }

    ok('Search complete')
    console.log(`  Platforms OK:   ${searchResponse.meta.platforms_succeeded.join(', ') || 'none'}`)
    if (Object.keys(searchResponse.meta.platforms_failed).length > 0) {
      warn(`  Platform issues: ${JSON.stringify(searchResponse.meta.platforms_failed)}`)
      explainSearchFailures(searchResponse.meta.platforms_failed)
    }
    console.log(`  Raw results:   ${searchResponse.meta.total_raw}`)
    console.log(`  After dedup:   ${searchResponse.meta.total_deduped}`)
    const fmtSrc = (o: Record<string, number>) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${s}=${n}`)
        .join(', ') || 'none'
    console.log(`  By source (raw):    ${fmtSrc(searchResponse.meta.by_source_raw)}`)
    console.log(`  By source (dedup):  ${fmtSrc(searchResponse.meta.by_source_deduped)}`)
    console.log(
      `  Returned slice:   ${searchResponse.jobs.length} job(s) (results_wanted=${previewResultsWanted})`
    )

    if (searchResponse.jobs.length === 0) {
      const failedMsgs = Object.values(searchResponse.meta.platforms_failed).join('\n')
      const quotaBlocked = /\b429\b|quota/i.test(failedMsgs)
      if (quotaBlocked) {
        warn('No jobs returned — quota/rate limits may have blocked APIs; try again later or broaden keys/plan.')
      } else {
        warn('No jobs returned — narrow keywords/locations, API errors (see Platform issues), or filters excluded every listing.')
        info('Put broader roles first in Bot keywords, relax exclude lists, or try fewer locations (--one-location).')
      }
    } else {
      console.log('\n  Sample jobs:')
      for (const job of searchResponse.jobs.slice(0, 5)) {
        console.log(`    • ${job.title} @ ${job.company} (${job.location ?? 'N/A'}) [${job.source}]`)
      }
      if (searchResponse.jobs.length > 5) {
        console.log(`    ... and ${searchResponse.jobs.length - 5} more`)
      }
    }
  }

  // ── 4. AI evaluation ──────────────────────────────────────────────────────
  // In dry-run mode we evaluate every returned job so the clamps can be observed
  // without writing to the DB. Outside dry-run we only spot-check the first,
  // because Step 6 will do the full evaluation pass via the orchestrator.
  if (searchResponse.jobs.length > 0 && openaiKey) {
    const evalAll = isDryRun
    h(
      evalAll
        ? `Step 4: AI evaluation (evaluating all ${searchResponse.jobs.length} sample jobs — dry-run mode)`
        : 'Step 4: AI evaluation (spot-check on first result)'
    )
    const { evaluateJob } = await import('../src/lib/bot/job-evaluator')
    const jobsToEval = evalAll ? searchResponse.jobs : searchResponse.jobs.slice(0, 1)
    type Row = {
      title: string
      company: string
      score: number
      shouldApply: boolean
      flags: string[]
      reasoning: string
      clamps: string[]
    }
    const rows: Row[] = []
    let n = 0
    for (const sample of jobsToEval) {
      n++
      try {
        info(`(${n}/${jobsToEval.length}) ${sample.title} @ ${sample.company}`)
        const { evaluation: ev, scoringInputs } = await evaluateJob(sample, botConfig)
        const clamps: string[] = []
        if (scoringInputs.stackMismatchClamp?.applied) {
          clamps.push(
            `stack ${scoringInputs.stackMismatchClamp.beforeScore}→${scoringInputs.stackMismatchClamp.afterScore}`
          )
        }
        if (scoringInputs.languageMismatchClamp?.applied) {
          clamps.push(
            `language ${scoringInputs.languageMismatchClamp.beforeScore}→${scoringInputs.languageMismatchClamp.afterScore}`
          )
        }
        if (scoringInputs.geoMismatchClamp?.applied) {
          clamps.push(
            `geo ${scoringInputs.geoMismatchClamp.beforeScore}→${scoringInputs.geoMismatchClamp.afterScore}`
          )
        }
        if (scoringInputs.seniorityClamp?.applied) {
          clamps.push(
            `seniority ${scoringInputs.seniorityClamp.beforeScore}→${scoringInputs.seniorityClamp.afterScore}`
          )
        }
        rows.push({
          title: sample.title,
          company: sample.company,
          score: ev.score,
          shouldApply: ev.shouldApply,
          flags: ev.flags,
          reasoning: ev.reasoning,
          clamps,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        warn(`AI eval failed for "${sample.title}": ${msg}`)
      }
    }

    if (rows.length > 0) {
      ok(`Evaluated ${rows.length} job(s)`)
      const sorted = [...rows].sort((a, b) => b.score - a.score)
      const keep = sorted.filter((r) => r.score >= botConfig.minScore)
      const drop = sorted.filter((r) => r.score < botConfig.minScore)
      console.log(`\n  ✅ Would be saved (score ≥ ${botConfig.minScore}):  ${keep.length}`)
      for (const r of keep) {
        console.log(
          `    [${String(r.score).padStart(3)}] ${r.title} @ ${r.company}  ${r.flags.length > 0 ? `· flags: ${r.flags.join(', ')}` : ''}${r.clamps.length > 0 ? ` · clamps: ${r.clamps.join('; ')}` : ''}`
        )
      }
      console.log(`\n  ❌ Would be skipped (score < ${botConfig.minScore}): ${drop.length}`)
      for (const r of drop) {
        console.log(
          `    [${String(r.score).padStart(3)}] ${r.title} @ ${r.company}  ${r.flags.length > 0 ? `· flags: ${r.flags.join(', ')}` : ''}${r.clamps.length > 0 ? ` · clamps: ${r.clamps.join('; ')}` : ''}`
        )
        console.log(`          ${r.reasoning.slice(0, 240)}${r.reasoning.length > 240 ? '…' : ''}`)
      }
    }
  }

  // ── 5. Dedup check ────────────────────────────────────────────────────────
  h('Step 5: Deduplication check')
  const urls = searchResponse.jobs.filter((j) => j.url).map((j) => j.url!)
  if (urls.length > 0) {
    const existing = await prisma.job.findMany({
      where: { userId, url: { in: urls } },
      select: { url: true, title: true },
    })
    ok(`${existing.length} of ${urls.length} URLs already in your DB (will be skipped)`)
    for (const j of existing.slice(0, 3)) {
      console.log(`    Already tracked: ${j.title}`)
    }
  } else {
    warn('Jobs have no URLs — cannot deduplicate')
  }

  // ── 6. DB save (unless dry-run) ───────────────────────────────────────────
  if (!isDryRun && searchResponse.jobs.length > 0) {
    h('Step 6: Save to DB (full orchestrator run)')
    const { runBotSearch } = await import('../src/lib/bot/search-orchestrator')
    info('Running orchestrator...')
    const result = await runBotSearch(botConfig, userId)
    ok('Orchestrator complete')
    console.log(`  Found:     ${result.jobsFound}`)
    console.log(`  New:       ${result.jobsNew}`)
    console.log(`  Evaluated: ${result.jobsEvaluated}`)
    console.log(`  Approved:  ${result.jobsApproved}`)
    console.log(
      `  Dedup:     url=${result.skippedExistingByUrl} title=${result.skippedExistingByTitle} batch=${result.skippedBatchDuplicate} dismissed=${result.skippedPreviouslyDismissed}`
    )
    console.log(`  Below min: ${result.jobsSkippedLowScore}`)
    if (result.evaluationSkips.length > 0) {
      info(`${result.evaluationSkips.length} below-threshold eval(s) — see evaluationSkips in result`)
    }
    if (Object.keys(result.errors).length > 0)
      warn(`  Errors: ${JSON.stringify(result.errors)}`)
  } else if (isDryRun) {
    h('Step 6: Save to DB')
    warn('Skipped (--dry-run)')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  h('✅ All checks passed')
  console.log('\nTo activate the bot, set these in Vercel and go to /settings/bot:')
  if (!jSearchKey) console.log('  JSEARCH_API_KEY  → https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch')
  if (!jobsSearchKey && !effectiveJobsSearchKey) {
    console.log(
      '  JOBS_SEARCH_API_KEY (optional if JSEARCH_API_KEY set) → RapidAPI jobs-search-api getjobs_excel'
    )
  }
  console.log('  TELEGRAM_BOT_TOKEN (optional) → @BotFather on Telegram')
  console.log('')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('\x1b[31m✗\x1b[0m Fatal:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})

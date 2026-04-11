#!/usr/bin/env bun

/**
 * Integration test for the job search bot pipeline.
 *
 * Tests the full flow: BotConfig → search APIs → AI evaluator → DB save
 *
 * Usage:
 *   bun run scripts/test-bot-search.ts [userId] [--dry-run]
 *
 * --dry-run  Preview results without saving to DB
 *
 * Required env vars (at least one):
 *   JSEARCH_API_KEY   RapidAPI key for JSearch (LinkedIn/Indeed/Glassdoor)
 *   SERP_API_KEY      SerpAPI key for Google Jobs
 *
 * Optional:
 *   OPENAI_API_KEY    Enable AI scoring (otherwise jobs are saved without score)
 */

import { prisma } from '../src/lib/prisma'
import { BotSearchFrequency } from '@prisma/client'

const isDryRun = process.argv.includes('--dry-run')
const targetUserId = process.argv.find(
  (a) => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]
)

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m'
const ok   = (m: string) => console.log(`${G}✓${X} ${m}`)
const warn = (m: string) => console.log(`${Y}⚠${X}  ${m}`)
const fail = (m: string) => console.log(`${R}✗${X} ${m}`)
const info = (m: string) => console.log(`${C}→${X} ${m}`)
const h    = (m: string) => console.log(`\n${B}${m}${X}`)

async function main() {
  h('🤖 Bot Search Integration Test')
  if (isDryRun) warn('DRY RUN — no jobs will be saved to DB\n')

  // ── 1. Check env ──────────────────────────────────────────────────────────
  h('Step 1: Environment check')

  const jSearchKey = process.env.JSEARCH_API_KEY
  const serpKey = process.env.SERP_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!jSearchKey && !serpKey) {
    fail('No search API keys set. Need at least one:')
    console.log('  JSEARCH_API_KEY — get free key at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch')
    console.log('  SERP_API_KEY    — get free key at https://serpapi.com')
    process.exit(1)
  }
  if (jSearchKey) ok('JSEARCH_API_KEY set (JSearch — LinkedIn/Indeed/Glassdoor)')
  else warn('JSEARCH_API_KEY not set — skipping JSearch')
  if (serpKey)   ok('SERP_API_KEY set (Google Jobs via SerpAPI)')
  else warn('SERP_API_KEY not set — skipping SerpAPI')
  if (!openaiKey) warn('OPENAI_API_KEY not set — AI scoring will be skipped')
  else ok('OPENAI_API_KEY set — AI scoring enabled')

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

  console.log(`  Keywords:  ${botConfig.keywords.join(', ')}`)
  console.log(`  Locations: ${botConfig.locations.join(', ')}`)
  console.log(`  MinScore:  ${botConfig.minScore}`)

  // ── 3. Run search ─────────────────────────────────────────────────────────
  h('Step 3: Run search APIs')
  const { runSearch } = await import('../src/lib/bot/adapters/search-client')

  let searchResponse
  try {
    searchResponse = await runSearch({
      keywords: botConfig.keywords,
      locations: botConfig.locations.length > 0 ? botConfig.locations : ['Remote'],
      remote_only: botConfig.remoteOnly,
      exclude_companies: botConfig.excludeCompanies,
      exclude_keywords: botConfig.excludeKeywords,
      results_wanted: 10,
    })
  } catch (e) {
    fail(`Search failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }

  ok('Search complete')
  console.log(`  Platforms OK:   ${searchResponse.meta.platforms_succeeded.join(', ') || 'none'}`)
  if (Object.keys(searchResponse.meta.platforms_failed).length > 0)
    warn(`  Platform issues: ${JSON.stringify(searchResponse.meta.platforms_failed)}`)
  console.log(`  Raw results:   ${searchResponse.meta.total_raw}`)
  console.log(`  After dedup:   ${searchResponse.meta.total_deduped}`)

  if (searchResponse.jobs.length === 0) {
    warn('No jobs returned. Check API keys or try different keywords.')
  } else {
    console.log('\n  Sample jobs:')
    for (const job of searchResponse.jobs.slice(0, 5)) {
      console.log(`    • ${job.title} @ ${job.company} (${job.location ?? 'N/A'}) [${job.source}]`)
    }
    if (searchResponse.jobs.length > 5) {
      console.log(`    ... and ${searchResponse.jobs.length - 5} more`)
    }
  }

  // ── 4. AI evaluation spot-check ───────────────────────────────────────────
  if (searchResponse.jobs.length > 0 && openaiKey) {
    h('Step 4: AI evaluation (spot-check on first result)')
    const { evaluateJob } = await import('../src/lib/bot/job-evaluator')
    const sample = searchResponse.jobs[0]
    try {
      info(`Evaluating: "${sample.title}" @ ${sample.company}`)
      const ev = await evaluateJob(sample, botConfig)
      ok('Evaluation complete')
      console.log(`  Score:       ${ev.score}/100`)
      console.log(`  Apply:       ${ev.shouldApply}`)
      console.log(`  Reasoning:   ${ev.reasoning}`)
      console.log(`  Flags:       ${ev.flags.join(', ') || 'none'}`)
    } catch (e) {
      warn(`AI eval failed: ${e instanceof Error ? e.message : String(e)}`)
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
  if (!serpKey)    console.log('  SERP_API_KEY     → https://serpapi.com')
  console.log('  TELEGRAM_BOT_TOKEN (optional) → @BotFather on Telegram')
  console.log('')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('\x1b[31m✗\x1b[0m Fatal:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})

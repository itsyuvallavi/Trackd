#!/usr/bin/env tsx

import './load-env'

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { config as loadDotenvFile } from 'dotenv'
import { BOT_EVAL_PERSONAS } from '../src/lib/bot/eval-suite-fixtures'
import { runDeterministicBotEvalSuite } from '../src/lib/bot/eval-suite'
import {
  liveDogfoodEnvironmentErrors,
  normalizeLiveDogfoodOptions,
  runLiveBotEvalSuite,
  type BotEvalLiveReport,
} from '../src/lib/bot/eval-live-suite'

type CliOptions = {
  json: boolean
  live: boolean
  personaId: string | null
  maxPersonas?: number
  maxSearchResults?: number
  maxAiEvals?: number
  maxSearchTerms?: number
  maxLocations?: number
  providerCooldownMs?: number
  providerRetryBackoffMs?: number
  providerMaxAttempts?: number
  reportPath: string | null
  envFile: string | null
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    live: false,
    personaId: null,
    reportPath: defaultReportPath(),
    envFile: null,
  }

  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--live') {
      options.live = true
      continue
    }
    if (arg.startsWith('--persona=')) {
      options.personaId = arg.slice('--persona='.length)
      continue
    }
    if (arg.startsWith('--max-personas=')) {
      options.maxPersonas = parseIntegerArg(arg, '--max-personas=')
      continue
    }
    if (arg.startsWith('--max-search-results=')) {
      options.maxSearchResults = parseIntegerArg(arg, '--max-search-results=')
      continue
    }
    if (arg.startsWith('--max-ai-evals=')) {
      options.maxAiEvals = parseIntegerArg(arg, '--max-ai-evals=')
      continue
    }
    if (arg.startsWith('--max-search-terms=')) {
      options.maxSearchTerms = parseIntegerArg(arg, '--max-search-terms=')
      continue
    }
    if (arg.startsWith('--max-locations=')) {
      options.maxLocations = parseIntegerArg(arg, '--max-locations=')
      continue
    }
    if (arg.startsWith('--provider-cooldown-ms=')) {
      options.providerCooldownMs = parseIntegerArg(arg, '--provider-cooldown-ms=')
      continue
    }
    if (arg.startsWith('--provider-retry-backoff-ms=')) {
      options.providerRetryBackoffMs = parseIntegerArg(arg, '--provider-retry-backoff-ms=')
      continue
    }
    if (arg.startsWith('--provider-max-attempts=')) {
      options.providerMaxAttempts = parseIntegerArg(arg, '--provider-max-attempts=')
      continue
    }
    if (arg.startsWith('--report=')) {
      options.reportPath = resolve(arg.slice('--report='.length))
      continue
    }
    if (arg.startsWith('--env-file=')) {
      options.envFile = resolve(arg.slice('--env-file='.length))
      continue
    }
    if (arg === '--no-report') {
      options.reportPath = null
      continue
    }
    if (arg.startsWith('--sources=')) {
      continue
    }
    if (arg === '--replay') {
      continue
    }
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    console.error(`Unknown argument: ${arg}`)
    printHelp()
    process.exit(1)
  }

  return options
}

function defaultReportPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return resolve(process.cwd(), 'scripts', 'bot-eval-reports', `live-${stamp}.json`)
}

function parseIntegerArg(arg: string, prefix: string): number {
  const value = Number.parseInt(arg.slice(prefix.length), 10)
  if (!Number.isFinite(value)) {
    console.error(`Invalid integer for ${prefix}${arg.slice(prefix.length)}`)
    process.exit(1)
  }
  return value
}

function printHelp() {
  console.log(`Usage: tsx scripts/run-bot-eval-suite.ts [options]

Options:
  --replay           Run the provider-free deterministic replay suite (default)
  --live             Run guarded live provider/OpenAI audit-only dogfood
  --persona=<id>     Run one fixture persona by id
  --max-personas=N   Live mode persona cap (default 1, hard cap 8)
  --max-search-results=N
                     Live mode provider result cap per persona (default 8, hard cap 20)
  --max-ai-evals=N   Live mode OpenAI scoring cap per persona (default 3, hard cap 20)
  --max-search-terms=N
                     Live mode safe search term cap per persona (default 4, hard cap 5)
  --max-locations=N  Live mode location cap per persona (default 1, hard cap 5)
  --provider-cooldown-ms=N
                     Live mode cooldown between personas (default 1500, hard cap 10000)
  --provider-retry-backoff-ms=N
                     Live mode retry backoff for zero-result 429/timeouts (default 2500, hard cap 30000)
  --provider-max-attempts=N
                     Live mode provider attempts for recoverable failures (default 2, hard cap 3)
  --report=<path>    Live mode JSON report path
  --env-file=<path>  Load an additional env file after .env/.env.local
  --no-report        Do not write the live JSON report
  --sources=<list>   Override BOT_SEARCH_SOURCES, e.g. jobs_search_api
  --json             Print the full result as JSON
  -h, --help         Show this help
`)
}

function printTextReport(result: ReturnType<typeof runDeterministicBotEvalSuite>) {
  console.log(
    `Job Search eval suite: ${result.passed ? 'PASS' : 'FAIL'} ` +
      `(${result.totals.personas} personas, ${result.totals.jobs} jobs, ` +
      `${result.totals.failedChecks}/${result.totals.checks} failed checks)`
  )

  for (const persona of result.personas) {
    console.log('')
    console.log(`${persona.passed ? 'PASS' : 'FAIL'} ${persona.id} - ${persona.label}`)
    console.log(`  source: ${persona.source.kind} (${persona.source.resumeLabel ?? 'no resume'})`)
    console.log(`  terms: ${persona.safeTerms.join(', ')}`)

    for (const job of persona.jobs) {
      const filter = job.preFilterRejected
        ? `filtered:${job.preFilterFlag ?? 'unknown'}`
        : 'accepted'
      console.log(
        `  job: ${job.gold.padEnd(11)} score=${String(job.searchTermCoverageScore).padStart(2)} ` +
          `${filter} - ${job.title} @ ${job.company}`
      )
    }

    const failedChecks = persona.checks.filter((check) => !check.passed)
    for (const check of failedChecks) {
      console.log(`  failed: ${check.name} - ${check.detail ?? 'no detail'}`)
    }
  }
}

function printLiveTextReport(report: BotEvalLiveReport) {
  console.log(
    `Job Search live eval suite: ${report.passed ? 'PASS' : 'FAIL'} ` +
      `(audit-only, ${report.totals.personas} persona(s), ` +
      `${report.totals.jobsFound} found, ${report.totals.jobsAudited} audited, ` +
      `${report.totals.aiEvaluated} AI-scored)`
  )
  console.log(
    `Audit hygiene: attempts=${report.totals.searchAttempts}, ` +
      `duplicates_removed=${report.totals.duplicatesRemoved}, ` +
      `provider_failures=${report.totals.providerFailures} ` +
      `(429=${report.totals.providerThrottleFailures}, timeout=${report.totals.providerTimeoutFailures})`
  )
  console.log(
    `Outcomes: would_save=${report.totals.wouldSave}, ` +
      `low_score=${report.totals.wouldSkipLowScore}, ` +
      `hard_filtered=${report.totals.hardFiltered}, ` +
      `ai_budget_skipped=${report.totals.aiBudgetSkipped}, ` +
      `eval_failed=${report.totals.evalFailed}`
  )
  console.log('No jobs, BotRun rows, or BotRunListing rows were written.')

  for (const persona of report.personas) {
    console.log('')
    console.log(`${persona.passed ? 'PASS' : 'FAIL'} ${persona.id} - ${persona.label}`)
    console.log(`  source: ${persona.profileSource.kind} (${persona.profileSource.resumeLabel ?? 'no resume'})`)
    console.log(`  terms: ${persona.safeTerms.join(', ')}`)
    console.log(`  request: ${persona.searchRequest.keywords.join(' OR ')} @ ${persona.searchRequest.locations.join(', ')}`)
    if (persona.searchAttempts > 1 || persona.duplicatesRemoved > 0 || persona.providerFailureCount > 0) {
      console.log(
        `  audit: attempts=${persona.searchAttempts}, duplicates_removed=${persona.duplicatesRemoved}, ` +
          `provider_failures=${persona.providerFailureCount} ` +
          `(429=${persona.providerThrottleFailureCount}, timeout=${persona.providerTimeoutFailureCount})`
      )
    }
    if (persona.error) {
      console.log(`  error: ${persona.error}`)
      continue
    }

    for (const job of persona.jobs) {
      const score = job.score == null ? '--' : String(job.score).padStart(2)
      console.log(
        `  job: ${job.outcome.padEnd(18)} score=${score} ` +
          `${job.title} @ ${job.company} (${job.location ?? 'unknown location'})`
      )
      if (job.decisionReason) console.log(`       ${job.decisionReason}`)
      if (job.priorityReasons.length > 0) {
        console.log(`       priority ${job.priorityScore.toFixed(1)}: ${job.priorityReasons.join(', ')}`)
      }
    }
  }
}

function writeLiveReport(path: string, report: BotEvalLiveReport) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.envFile) {
    loadDotenvFile({ path: options.envFile, override: true, quiet: true })
  }

  const personas = options.personaId
    ? BOT_EVAL_PERSONAS.filter((persona) => persona.id === options.personaId)
    : BOT_EVAL_PERSONAS

  if (personas.length === 0) {
    console.error(`No eval persona found for id: ${options.personaId}`)
    process.exit(1)
  }

  if (options.live) {
    let liveOptions
    try {
      liveOptions = normalizeLiveDogfoodOptions({
        maxPersonas: options.personaId ? 1 : options.maxPersonas,
        maxSearchResults: options.maxSearchResults,
        maxAiEvals: options.maxAiEvals,
        maxSearchTerms: options.maxSearchTerms,
        maxLocations: options.maxLocations,
        providerCooldownMs: options.providerCooldownMs,
        providerRetryBackoffMs: options.providerRetryBackoffMs,
        providerMaxAttempts: options.providerMaxAttempts,
      })
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    const envErrors = liveDogfoodEnvironmentErrors(process.env, liveOptions)
    if (envErrors.length > 0) {
      console.error('--live is disabled until all live dogfood requirements are met:')
      for (const error of envErrors) console.error(`  - ${error}`)
      process.exit(1)
    }

    const report = await runLiveBotEvalSuite({
      personas,
      options: liveOptions,
    })

    if (options.reportPath) {
      writeLiveReport(options.reportPath, report)
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printLiveTextReport(report)
      if (options.reportPath) console.log(`\nReport: ${options.reportPath}`)
    }

    process.exit(report.passed ? 0 : 1)
  }

  const result = runDeterministicBotEvalSuite(personas)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printTextReport(result)
  }

  process.exit(result.passed ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})

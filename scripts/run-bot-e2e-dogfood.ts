#!/usr/bin/env tsx

import './load-env'

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { executeBotRunForConfig } from '../src/lib/bot/execute-bot-run'
import {
  botSearchHasQueryableBackend,
  effectiveSearchBackendLabels,
} from '../src/lib/bot/bot-search-sources'
import {
  BOT_EVAL_PERSONAS,
  type BotEvalPersonaFixture,
} from '../src/lib/bot/eval-suite-fixtures'

type CliOptions = {
  personaId: string | null
  maxPersonas: number | null
  reset: boolean
  reportPath: string
  cooldownMs: number
}

type ListingSummary = {
  sequence: number
  stage: string
  outcome: string
  title: string
  company: string
  url: string | null
  evaluated: boolean
  score: number | null
  shouldApply: boolean | null
  flags: string[]
  decisionReason: string | null
  errorMessage: string | null
  profileSource: {
    kind: string | null
    label: string | null
    resumeId: string | null
    resumeLabel: string | null
    settingsDerivedSignalsUsed: boolean | null
  }
  searchProfile: {
    terms: string[]
    derivedFromResume: boolean | null
  }
  priority: {
    score: number | null
    reasons: string[]
  }
}

type PersonaE2EReport = {
  personaId: string
  label: string
  userId: string
  email: string
  configId: string
  resumeId: string
  runId: string
  status: string | null
  result: {
    jobsFound: number
    jobsNew: number
    jobsApproved: number
    jobsHardFiltered: number
    jobsSkippedLowScore: number
    jobsEvaluationFailed: number
    error?: string
  }
  persistedRun: {
    jobsFound: number
    jobsNew: number
    jobsEvaluated: number
    jobsApproved: number
    durationMs: number | null
    searchMeta: unknown
    errors: unknown
  } | null
  listings: ListingSummary[]
  listingCounts: Record<string, number>
  savedJobs: Array<{
    id: string
    title: string
    company: string
    location: string | null
    url: string | null
    botScore: number | null
    tags: string[]
  }>
  logs: Array<{
    sequence: number
    level: string
    message: string
    meta: unknown
  }>
}

type DogfoodReport = {
  mode: 'e2e-dogfood'
  createdAt: string
  auditOnly: false
  options: {
    reset: boolean
    cooldownMs: number
    personaCount: number
  }
  environment: {
    backends: string[]
    openAiScoring: boolean
  }
  totals: {
    personas: number
    completed: number
    failed: number
    jobsFound: number
    jobsNew: number
    jobsEvaluated: number
    jobsApproved: number
    jobsHardFiltered: number
    jobsSkippedLowScore: number
    jobsEvaluationFailed: number
    botRunListings: number
    savedJobs: number
    providerFailures: number
    providerDuplicates: number
  }
  personas: PersonaE2EReport[]
}

const DOGFOOD_PREFIX = 'dogfood-e2e'
const DEFAULT_REPORT_PATH = `/private/tmp/trackd-bot-e2e-dogfood-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}.json`

function parseIntegerArg(arg: string, prefix: string): number {
  const value = Number.parseInt(arg.slice(prefix.length), 10)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${prefix}${arg.slice(prefix.length)} must be a non-negative integer`)
  }
  return value
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    personaId: null,
    maxPersonas: null,
    reset: false,
    reportPath: DEFAULT_REPORT_PATH,
    cooldownMs: 5_000,
  }

  for (const arg of argv) {
    if (arg === '--reset') {
      options.reset = true
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
    if (arg.startsWith('--cooldown-ms=')) {
      options.cooldownMs = parseIntegerArg(arg, '--cooldown-ms=')
      continue
    }
    if (arg.startsWith('--report=')) {
      options.reportPath = resolve(arg.slice('--report='.length))
      continue
    }
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(`Usage: tsx scripts/run-bot-e2e-dogfood.ts [options]

Runs the real Job Search bot pipeline for seeded synthetic users.

Options:
  --reset            Delete prior dogfood E2E data for selected personas before seeding.
  --persona=<id>     Run one fixture persona by id.
  --max-personas=N   Run the first N fixture personas.
  --cooldown-ms=N    Delay between real bot runs (default 5000).
  --report=<path>    JSON report path (default /private/tmp/trackd-bot-e2e-dogfood-*.json).

Required env:
  RUN_BOT_E2E_DOGFOOD=1
  DATABASE_URL
  JOBS_SEARCH_API_KEY
  OPENAI_API_KEY
`)
}

function selectedPersonas(options: CliOptions): BotEvalPersonaFixture[] {
  let personas = BOT_EVAL_PERSONAS
  if (options.personaId) {
    personas = personas.filter((persona) => persona.id === options.personaId)
    if (personas.length === 0) {
      throw new Error(`No eval persona found for --persona=${options.personaId}`)
    }
  }
  if (options.maxPersonas != null) {
    personas = personas.slice(0, options.maxPersonas)
  }
  return personas
}

function dogfoodUserId(persona: BotEvalPersonaFixture): string {
  return `${DOGFOOD_PREFIX}-${persona.id}`
}

function dogfoodEmail(persona: BotEvalPersonaFixture): string {
  return `${DOGFOOD_PREFIX}+${persona.id}@example.invalid`
}

function dogfoodResumeId(persona: BotEvalPersonaFixture): string {
  return `${DOGFOOD_PREFIX}-resume-${persona.id}`
}

function dogfoodProfileId(persona: BotEvalPersonaFixture): string {
  return `${DOGFOOD_PREFIX}-application-profile-${persona.id}`
}

function assertEnvironment(options: CliOptions) {
  const errors: string[] = []
  if (process.env.RUN_BOT_E2E_DOGFOOD !== '1') {
    errors.push('RUN_BOT_E2E_DOGFOOD=1 is required because this writes real DB rows.')
  }
  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL is required.')
  }
  if (!botSearchHasQueryableBackend()) {
    errors.push('No live search backend is configured. Set JOBS_SEARCH_API_KEY.')
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    errors.push('OPENAI_API_KEY is required so this exercises real AI scoring.')
  }
  if (options.cooldownMs < 1_000) {
    errors.push('--cooldown-ms must be at least 1000 for live provider safety.')
  }
  if (errors.length > 0) {
    throw new Error(`E2E dogfood requirements failed:\n- ${errors.join('\n- ')}`)
  }
}

async function resetDogfoodData(userIds: string[]) {
  if (userIds.length === 0) return

  const runs = await prisma.botRun.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  })
  const runIds = runs.map((run) => run.id)

  if (runIds.length > 0) {
    await prisma.botRunListing.deleteMany({ where: { botRunId: { in: runIds } } })
    await prisma.botRunLog.deleteMany({ where: { botRunId: { in: runIds } } })
    await prisma.botRun.deleteMany({ where: { id: { in: runIds } } })
  }

  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.dismissedJobImport.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.job.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.botResume.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.botConfig.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.applicationProfile.deleteMany({ where: { userId: { in: userIds } } })
}

async function seedPersona(persona: BotEvalPersonaFixture) {
  const userId = dogfoodUserId(persona)
  const email = dogfoodEmail(persona)
  const resumeId = dogfoodResumeId(persona)
  const profile = persona.applicationProfile

  await prisma.profile.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      name: profile.applicationFullName ?? persona.label,
      avatarUrl: null,
    },
    update: {
      email,
      name: profile.applicationFullName ?? persona.label,
      avatarUrl: null,
    },
  })

  await prisma.applicationProfile.upsert({
    where: { userId },
    create: {
      id: dogfoodProfileId(persona),
      userId,
      applicationFullName: profile.applicationFullName,
      applicationEmail: email,
      portalSignupPassword: null,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      workAuthorization: profile.workAuthorization,
      requiresSponsorship: profile.requiresSponsorship,
      salaryExpectation: profile.salaryExpectation,
      noticePeriod: profile.noticePeriod,
      yearsExperience: profile.yearsExperience,
    },
    update: {
      applicationFullName: profile.applicationFullName,
      applicationEmail: email,
      portalSignupPassword: null,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      workAuthorization: profile.workAuthorization,
      requiresSponsorship: profile.requiresSponsorship,
      salaryExpectation: profile.salaryExpectation,
      noticePeriod: profile.noticePeriod,
      yearsExperience: profile.yearsExperience,
    },
  })

  const config = await prisma.botConfig.upsert({
    where: { userId },
    create: {
      userId,
      keywords: persona.config.keywords,
      locations: persona.config.locations,
      excludeCompanies: persona.config.excludeCompanies,
      excludeKeywords: persona.config.excludeKeywords,
      spokenLanguages: persona.config.spokenLanguages,
      remoteOnly: persona.config.remoteOnly,
      experienceLevel: persona.config.experienceLevel,
      salaryMin: persona.config.salaryMin,
      isActive: true,
      searchFrequency: 'DAILY',
      lastSearchAt: null,
      telegramChatId: null,
      minScore: persona.config.minScore,
    },
    update: {
      keywords: persona.config.keywords,
      locations: persona.config.locations,
      excludeCompanies: persona.config.excludeCompanies,
      excludeKeywords: persona.config.excludeKeywords,
      spokenLanguages: persona.config.spokenLanguages,
      remoteOnly: persona.config.remoteOnly,
      experienceLevel: persona.config.experienceLevel,
      salaryMin: persona.config.salaryMin,
      isActive: true,
      searchFrequency: 'DAILY',
      lastSearchAt: null,
      telegramChatId: null,
      minScore: persona.config.minScore,
    },
  })

  await prisma.botResume.upsert({
    where: { id: resumeId },
    create: {
      id: resumeId,
      userId,
      label: persona.resume.label,
      matchKeywords: persona.resume.matchKeywords,
      isDefault: true,
      fileUrl: `dogfood://bot-resumes/${resumeId}.txt`,
      fileName: `${resumeId}.txt`,
      rawText: persona.resume.rawText,
      structuredData: persona.resume.structuredData as Prisma.InputJsonValue,
    },
    update: {
      userId,
      label: persona.resume.label,
      matchKeywords: persona.resume.matchKeywords,
      isDefault: true,
      fileUrl: `dogfood://bot-resumes/${resumeId}.txt`,
      fileName: `${resumeId}.txt`,
      rawText: persona.resume.rawText,
      structuredData: persona.resume.structuredData as Prisma.InputJsonValue,
    },
  })

  return { userId, email, config, resumeId }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[redacted:depth]'
  if (Array.isArray(value)) return value.map((item) => redactJson(item, depth + 1))
  if (!isObject(value)) {
    if (typeof value === 'string' && value.length > 1_000) {
      return `${value.slice(0, 1_000)}... [truncated]`
    }
    return value
  }

  const out: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value)) {
    if (/raw.*resume|resume.*text|password|token|secret|api[_-]?key|prompt/i.test(key)) {
      out[key] = '[redacted]'
    } else {
      out[key] = redactJson(nested, depth + 1)
    }
  }
  return out
}

function scoringSummary(scoringInputs: unknown): Omit<
  ListingSummary,
  | 'sequence'
  | 'stage'
  | 'outcome'
  | 'title'
  | 'company'
  | 'url'
  | 'evaluated'
  | 'score'
  | 'shouldApply'
  | 'flags'
  | 'decisionReason'
  | 'errorMessage'
> {
  const root = isObject(scoringInputs) ? scoringInputs : {}
  const profileSource = isObject(root.profileSource) ? root.profileSource : {}
  const resumeUsed = isObject(root.resumeUsed) ? root.resumeUsed : {}
  const searchProfile = isObject(root.searchProfile) ? root.searchProfile : {}

  return {
    profileSource: {
      kind: stringValue(profileSource.kind) ?? stringValue(resumeUsed.sourceKind),
      label: stringValue(profileSource.label) ?? stringValue(resumeUsed.sourceLabel),
      resumeId: stringValue(profileSource.resumeId) ?? stringValue(resumeUsed.resumeId),
      resumeLabel: stringValue(profileSource.resumeLabel) ?? stringValue(resumeUsed.label),
      settingsDerivedSignalsUsed:
        booleanValue(profileSource.settingsDerivedSignalsUsed) ??
        booleanValue(resumeUsed.settingsDerivedSignalsUsed),
    },
    searchProfile: {
      terms: stringArray(searchProfile.terms),
      derivedFromResume: booleanValue(searchProfile.derivedFromResume),
    },
    priority: {
      score: numberValue(root.priorityScore),
      reasons: stringArray(root.priorityReasons),
    },
  }
}

async function collectRunReport(input: {
  persona: BotEvalPersonaFixture
  userId: string
  email: string
  configId: string
  resumeId: string
  runId: string
  result: Awaited<ReturnType<typeof executeBotRunForConfig>>
}): Promise<PersonaE2EReport> {
  const [run, savedJobs] = await Promise.all([
    prisma.botRun.findUnique({
      where: { id: input.runId },
      include: {
        botRunLogs: { orderBy: { sequence: 'asc' } },
        botRunListings: { orderBy: { sequence: 'asc' } },
      },
    }),
    prisma.job.findMany({
      where: { userId: input.userId, tags: { has: 'bot-found' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        url: true,
        botScore: true,
        tags: true,
      },
    }),
  ])

  const listings =
    run?.botRunListings.map((listing): ListingSummary => ({
      sequence: listing.sequence,
      stage: listing.stage,
      outcome: listing.outcome,
      title: listing.title,
      company: listing.company,
      url: listing.url,
      evaluated: listing.evaluated,
      score: listing.score,
      shouldApply: listing.shouldApply,
      flags: listing.flags,
      decisionReason: listing.decisionReason,
      errorMessage: listing.errorMessage,
      ...scoringSummary(listing.scoringInputs),
    })) ?? []

  const listingCounts = listings.reduce<Record<string, number>>((acc, listing) => {
    const key = `${listing.stage}:${listing.outcome}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return {
    personaId: input.persona.id,
    label: input.persona.label,
    userId: input.userId,
    email: input.email,
    configId: input.configId,
    resumeId: input.resumeId,
    runId: input.runId,
    status: run?.status ?? null,
    result: input.result,
    persistedRun: run
      ? {
          jobsFound: run.jobsFound,
          jobsNew: run.jobsNew,
          jobsEvaluated: run.jobsEvaluated,
          jobsApproved: run.jobsApproved,
          durationMs: run.duration,
          searchMeta: redactJson(run.searchMeta),
          errors: redactJson(run.errors),
        }
      : null,
    listings,
    listingCounts,
    savedJobs,
    logs:
      run?.botRunLogs.map((log) => ({
        sequence: log.sequence,
        level: log.level,
        message: log.message,
        meta: redactJson(log.meta),
      })) ?? [],
  }
}

function providerFailureCount(persona: PersonaE2EReport): number {
  const meta = persona.persistedRun?.searchMeta
  if (!isObject(meta)) return 0
  const failed = meta.platforms_failed
  return isObject(failed) ? Object.keys(failed).length : 0
}

function providerDuplicateCount(persona: PersonaE2EReport): number {
  const meta = persona.persistedRun?.searchMeta
  if (!isObject(meta)) return 0
  const stats = meta.duplicate_stats
  if (!isObject(stats)) return 0
  return typeof stats.removed_total === 'number' ? stats.removed_total : 0
}

function buildTotals(personas: PersonaE2EReport[]): DogfoodReport['totals'] {
  return {
    personas: personas.length,
    completed: personas.filter((persona) => persona.status === 'COMPLETED').length,
    failed: personas.filter((persona) => persona.status !== 'COMPLETED').length,
    jobsFound: personas.reduce((total, persona) => total + (persona.persistedRun?.jobsFound ?? 0), 0),
    jobsNew: personas.reduce((total, persona) => total + (persona.persistedRun?.jobsNew ?? 0), 0),
    jobsEvaluated: personas.reduce(
      (total, persona) => total + (persona.persistedRun?.jobsEvaluated ?? 0),
      0
    ),
    jobsApproved: personas.reduce(
      (total, persona) => total + (persona.persistedRun?.jobsApproved ?? 0),
      0
    ),
    jobsHardFiltered: personas.reduce(
      (total, persona) => total + persona.result.jobsHardFiltered,
      0
    ),
    jobsSkippedLowScore: personas.reduce(
      (total, persona) => total + persona.result.jobsSkippedLowScore,
      0
    ),
    jobsEvaluationFailed: personas.reduce(
      (total, persona) => total + persona.result.jobsEvaluationFailed,
      0
    ),
    botRunListings: personas.reduce((total, persona) => total + persona.listings.length, 0),
    savedJobs: personas.reduce((total, persona) => total + persona.savedJobs.length, 0),
    providerFailures: personas.reduce((total, persona) => total + providerFailureCount(persona), 0),
    providerDuplicates: personas.reduce(
      (total, persona) => total + providerDuplicateCount(persona),
      0
    ),
  }
}

function writeReport(path: string, report: DogfoodReport) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  assertEnvironment(options)
  const personas = selectedPersonas(options)
  const userIds = personas.map(dogfoodUserId)

  console.log(
    `Job Search E2E dogfood: ${personas.length} persona(s), reset=${options.reset ? 'yes' : 'no'}`
  )
  console.log(`Backends: ${effectiveSearchBackendLabels().join(', ') || '(none)'}`)
  console.log('This run writes synthetic Profile, BotConfig, BotResume, BotRun, BotRunListing, Notification, and Job rows.')

  if (options.reset) {
    console.log(`Resetting previous E2E dogfood rows for ${userIds.length} synthetic user(s)...`)
    await resetDogfoodData(userIds)
  }

  const personaReports: PersonaE2EReport[] = []
  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i]
    if (i > 0 && options.cooldownMs > 0) {
      await sleep(options.cooldownMs)
    }

    const seeded = await seedPersona(persona)
    console.log(
      `[${i + 1}/${personas.length}] Running ${persona.id} as ${seeded.userId} with resume ${seeded.resumeId}`
    )
    const result = await executeBotRunForConfig(seeded.config, 'manual')
    const report = await collectRunReport({
      persona,
      userId: seeded.userId,
      email: seeded.email,
      configId: seeded.config.id,
      resumeId: seeded.resumeId,
      runId: result.runId,
      result,
    })
    personaReports.push(report)

    console.log(
      `  ${report.status ?? 'UNKNOWN'} run=${result.runId} found=${result.jobsFound} ` +
        `saved=${result.jobsNew} approved=${result.jobsApproved} listings=${report.listings.length}`
    )
    if (result.error) {
      console.log(`  error=${result.error}`)
    }
  }

  const report: DogfoodReport = {
    mode: 'e2e-dogfood',
    createdAt: new Date().toISOString(),
    auditOnly: false,
    options: {
      reset: options.reset,
      cooldownMs: options.cooldownMs,
      personaCount: personas.length,
    },
    environment: {
      backends: effectiveSearchBackendLabels(),
      openAiScoring: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
    totals: buildTotals(personaReports),
    personas: personaReports,
  }

  writeReport(options.reportPath, report)
  console.log(
    `Job Search E2E dogfood: ${report.totals.failed === 0 ? 'PASS' : 'FAIL'} ` +
      `(${report.totals.completed}/${report.totals.personas} completed, ` +
      `${report.totals.jobsFound} found, ${report.totals.jobsEvaluated} AI-scored, ` +
      `${report.totals.jobsNew} saved, ${report.totals.jobsApproved} approved)`
  )
  console.log(`Provider failures: ${report.totals.providerFailures}`)
  console.log(`Provider duplicates removed before audit: ${report.totals.providerDuplicates}`)
  console.log(`Report: ${options.reportPath}`)

  if (report.totals.failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

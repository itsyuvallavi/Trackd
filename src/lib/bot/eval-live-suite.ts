import type { BotConfig } from '@prisma/client'
import { runSearch as defaultRunSearch } from './adapters/search-client'
import { buildCandidateProfileFromSources, type CandidateProfile } from './candidate-profile'
import {
  evaluateJobWithCandidateProfile as defaultEvaluateJobWithCandidateProfile,
  type EvaluateJobResult,
  type ScoringInputsSnapshot,
} from './job-evaluator'
import { preFilterJob } from './pre-filter'
import { buildBotSearchRequest } from './search-request'
import { buildSafeSearchProfile } from './search-profile'
import type { JobEvaluation, SearchJobResult, SearchMeta, SearchRequest, SearchResponse } from './types'
import {
  BOT_EVAL_PERSONAS,
  type BotEvalPersonaFixture,
} from './eval-suite-fixtures'
import { scoreSearchTermCoverage } from './eval-suite'
import { companyTitleKey, normalizeJobUrl } from './bot-run-audit'
import type { PreFilterResult } from './pre-filter'

export const LIVE_DOGFOOD_DEFAULTS = {
  maxPersonas: 1,
  maxSearchResults: 8,
  maxAiEvals: 3,
  maxSearchTerms: 4,
  maxLocations: 1,
  providerCooldownMs: 1500,
  providerRetryBackoffMs: 2500,
  providerMaxAttempts: 2,
}

export const LIVE_DOGFOOD_LIMITS = {
  maxPersonas: 8,
  maxSearchResults: 20,
  maxAiEvals: 20,
  maxSearchTerms: 5,
  maxLocations: 5,
  providerCooldownMs: 10000,
  providerRetryBackoffMs: 30000,
  providerMaxAttempts: 3,
}

export type BotEvalLiveOptions = typeof LIVE_DOGFOOD_DEFAULTS

export type BotEvalLiveJobOutcome =
  | 'would_save'
  | 'would_skip_low_score'
  | 'hard_filtered'
  | 'ai_budget_skipped'
  | 'eval_failed'

export type BotEvalLiveJobReport = {
  title: string
  company: string
  location: string | null
  url: string | null
  source: string
  jobBoard: string | null
  isRemote: boolean | null
  descriptionCharCount: number
  descriptionPreview: string
  providerPass: SearchJobResult['providerPass'] | null
  outcome: BotEvalLiveJobOutcome
  decisionReason: string
  evaluated: boolean
  score: number | null
  shouldApply: boolean | null
  flags: string[]
  reasoning: string | null
  resumeMatch: string | null
  searchTermCoverageScore: number
  priorityScore: number
  priorityReasons: string[]
  scoringInputs: ScoringInputsSnapshot | null
}

export type BotEvalLiveDuplicateGroup = {
  reason: 'url' | 'company_title'
  key: string
  kept: {
    title: string
    company: string
    url: string | null
  }
  duplicates: Array<{
    title: string
    company: string
    url: string | null
  }>
  count: number
}

export type BotEvalLivePersonaReport = {
  id: string
  label: string
  passed: boolean
  profileSource: {
    kind: string
    label: string
    resumeId: string | null
    resumeLabel: string | null
  }
  safeTerms: string[]
  searchRequest: SearchRequest
  searchMeta: SearchMeta | null
  jobsFound: number
  jobsAudited: number
  aiEvaluated: number
  searchAttempts: number
  duplicatesRemoved: number
  duplicateGroups: BotEvalLiveDuplicateGroup[]
  providerFailureCount: number
  providerThrottleFailureCount: number
  providerTimeoutFailureCount: number
  providerFailures: Record<string, string>
  jobs: BotEvalLiveJobReport[]
  error: string | null
}

export type BotEvalLiveReport = {
  mode: 'live-audit'
  auditOnly: true
  createdAt: string
  passed: boolean
  options: BotEvalLiveOptions
  totals: {
    personas: number
    personasPassed: number
    personasFailed: number
    jobsFound: number
    jobsAudited: number
    aiEvaluated: number
    searchAttempts: number
    duplicatesRemoved: number
    providerFailures: number
    providerThrottleFailures: number
    providerTimeoutFailures: number
    wouldSave: number
    wouldSkipLowScore: number
    hardFiltered: number
    aiBudgetSkipped: number
    evalFailed: number
  }
  personas: BotEvalLivePersonaReport[]
}

export type BotEvalLiveDeps = {
  runSearch?: (request: SearchRequest) => Promise<SearchResponse>
  evaluateJob?: (
    job: SearchJobResult,
    config: BotConfig,
    candidateProfile: CandidateProfile
  ) => Promise<EvaluateJobResult>
  sleep?: (ms: number) => Promise<void>
}

type RunLiveBotEvalSuiteInput = {
  personas?: BotEvalPersonaFixture[]
  options?: Partial<BotEvalLiveOptions>
  deps?: BotEvalLiveDeps
  now?: Date
}

function integerOption(
  name: keyof BotEvalLiveOptions,
  value: number | undefined,
  fallback: number,
  max: number
): number {
  const resolved = value ?? fallback
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  if (resolved > max) {
    throw new Error(`${name}=${resolved} exceeds live dogfood cap ${max}`)
  }
  return resolved
}

export function normalizeLiveDogfoodOptions(
  input: Partial<BotEvalLiveOptions> = {}
): BotEvalLiveOptions {
  return {
    maxPersonas: integerOption(
      'maxPersonas',
      input.maxPersonas,
      LIVE_DOGFOOD_DEFAULTS.maxPersonas,
      LIVE_DOGFOOD_LIMITS.maxPersonas
    ),
    maxSearchResults: integerOption(
      'maxSearchResults',
      input.maxSearchResults,
      LIVE_DOGFOOD_DEFAULTS.maxSearchResults,
      LIVE_DOGFOOD_LIMITS.maxSearchResults
    ),
    maxAiEvals: integerOption(
      'maxAiEvals',
      input.maxAiEvals,
      LIVE_DOGFOOD_DEFAULTS.maxAiEvals,
      LIVE_DOGFOOD_LIMITS.maxAiEvals
    ),
    maxSearchTerms: integerOption(
      'maxSearchTerms',
      input.maxSearchTerms,
      LIVE_DOGFOOD_DEFAULTS.maxSearchTerms,
      LIVE_DOGFOOD_LIMITS.maxSearchTerms
    ),
    maxLocations: integerOption(
      'maxLocations',
      input.maxLocations,
      LIVE_DOGFOOD_DEFAULTS.maxLocations,
      LIVE_DOGFOOD_LIMITS.maxLocations
    ),
    providerCooldownMs: integerOption(
      'providerCooldownMs',
      input.providerCooldownMs,
      LIVE_DOGFOOD_DEFAULTS.providerCooldownMs,
      LIVE_DOGFOOD_LIMITS.providerCooldownMs
    ),
    providerRetryBackoffMs: integerOption(
      'providerRetryBackoffMs',
      input.providerRetryBackoffMs,
      LIVE_DOGFOOD_DEFAULTS.providerRetryBackoffMs,
      LIVE_DOGFOOD_LIMITS.providerRetryBackoffMs
    ),
    providerMaxAttempts: Math.max(
      1,
      integerOption(
        'providerMaxAttempts',
        input.providerMaxAttempts,
        LIVE_DOGFOOD_DEFAULTS.providerMaxAttempts,
        LIVE_DOGFOOD_LIMITS.providerMaxAttempts
      )
    ),
  }
}

export function liveDogfoodEnvironmentErrors(
  env: Record<string, string | undefined>,
  options: Pick<BotEvalLiveOptions, 'maxAiEvals'>
): string[] {
  const errors: string[] = []
  if (env.RUN_BOT_EVAL_SUITE_LIVE !== '1') {
    errors.push('RUN_BOT_EVAL_SUITE_LIVE=1 is required for --live.')
  }
  if (!env.JOBS_SEARCH_API_KEY?.trim()) {
    errors.push('JOBS_SEARCH_API_KEY is required for live provider search.')
  }
  if (options.maxAiEvals > 0 && !env.OPENAI_API_KEY?.trim()) {
    errors.push('OPENAI_API_KEY is required when maxAiEvals is greater than 0.')
  }

  const sourceTokens = (env.BOT_SEARCH_SOURCES ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
  if (sourceTokens.length > 0 && !sourceTokens.includes('jobs_search_api')) {
    errors.push('BOT_SEARCH_SOURCES excludes jobs_search_api, so no live backend would run.')
  }

  return errors
}

function searchConfigForLive(persona: BotEvalPersonaFixture, maxLocations: number): BotConfig {
  return {
    ...persona.config,
    locations: persona.config.locations.slice(0, Math.max(1, maxLocations)),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function providerFailuresFromMeta(meta: SearchMeta | null): Record<string, string> {
  return meta?.platforms_failed ?? {}
}

function isProviderThrottleFailure(message: string): boolean {
  return /\b429\b|rate limit|too many requests/i.test(message)
}

function isProviderTimeoutFailure(message: string): boolean {
  return /timeout|timed out|etimedout/i.test(message)
}

function isRecoverableProviderFailure(message: string): boolean {
  return isProviderThrottleFailure(message) || isProviderTimeoutFailure(message)
}

function recoverableProviderFailures(meta: SearchMeta | null): string[] {
  return Object.values(providerFailuresFromMeta(meta)).filter(isRecoverableProviderFailure)
}

function providerFailureCounts(meta: SearchMeta | null): {
  total: number
  throttle: number
  timeout: number
} {
  const failures = Object.values(providerFailuresFromMeta(meta))
  return {
    total: failures.length,
    throttle: failures.filter(isProviderThrottleFailure).length,
    timeout: failures.filter(isProviderTimeoutFailure).length,
  }
}

async function runSearchWithRetry(
  request: SearchRequest,
  options: BotEvalLiveOptions,
  deps: Required<BotEvalLiveDeps>
): Promise<{ response: SearchResponse; attempts: number }> {
  const maxAttempts = Math.max(1, options.providerMaxAttempts)
  let attempts = 0

  for (;;) {
    attempts++
    try {
      const response = await deps.runSearch(request)
      const shouldRetry =
        response.jobs.length === 0 &&
        recoverableProviderFailures(response.meta).length > 0 &&
        attempts < maxAttempts

      if (!shouldRetry) {
        return { response, attempts }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!isRecoverableProviderFailure(message) || attempts >= maxAttempts) {
        throw error
      }
    }

    const waitMs = options.providerRetryBackoffMs * attempts
    if (waitMs > 0) await deps.sleep(waitMs)
  }
}

function compactJob(job: SearchJobResult): Omit<
  BotEvalLiveJobReport,
  | 'outcome'
  | 'decisionReason'
  | 'evaluated'
  | 'score'
  | 'shouldApply'
  | 'flags'
  | 'reasoning'
  | 'resumeMatch'
  | 'searchTermCoverageScore'
  | 'priorityScore'
  | 'priorityReasons'
  | 'scoringInputs'
> {
  const description = job.description ?? ''
  return {
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    url: job.url ?? null,
    source: job.source,
    jobBoard: job.jobBoard ?? null,
    isRemote: job.is_remote ?? null,
    descriptionCharCount: description.length,
    descriptionPreview: description.trim().slice(0, 700),
    providerPass: job.providerPass ?? null,
  }
}

type LiveAuditJob = {
  job: SearchJobResult
  originalIndex: number
  preFilter: PreFilterResult
  searchTermCoverageScore: number
  priorityScore: number
  priorityReasons: string[]
}

function jobIdentity(job: SearchJobResult): {
  title: string
  company: string
  url: string | null
} {
  return {
    title: job.title,
    company: job.company,
    url: job.url ?? null,
  }
}

function addDuplicate(
  groups: Map<string, BotEvalLiveDuplicateGroup>,
  reason: BotEvalLiveDuplicateGroup['reason'],
  key: string,
  kept: SearchJobResult,
  duplicate: SearchJobResult
) {
  const groupKey = `${reason}:${key}`
  const existing = groups.get(groupKey)
  if (existing) {
    existing.duplicates.push(jobIdentity(duplicate))
    existing.count += 1
    return
  }

  groups.set(groupKey, {
    reason,
    key,
    kept: jobIdentity(kept),
    duplicates: [jobIdentity(duplicate)],
    count: 2,
  })
}

function livePriorityForJob(
  job: SearchJobResult,
  config: BotConfig,
  safeTerms: string[],
  originalIndex: number,
  preFilter: PreFilterResult
): LiveAuditJob {
  const coverage = scoreSearchTermCoverage({ ...job, id: job.url ?? job.title, gold: 'partial' }, safeTerms)
  const descriptionLength = (job.description ?? '').trim().length
  const reasons: string[] = []
  let score = coverage

  if (coverage > 0) reasons.push(`term_coverage:${coverage}`)

  if (descriptionLength >= 600) {
    score += 12
    reasons.push('description:substantial')
  } else if (descriptionLength > 0 && descriptionLength < 120) {
    score -= 8
    reasons.push('description:sparse')
  }

  if (job.is_remote && (config.remoteOnly || config.locations.some((location) => /remote/i.test(location)))) {
    score += 10
    reasons.push('location:remote_signal')
  }

  if (job.jobBoard) {
    score += 2
    reasons.push(`board:${job.jobBoard}`)
  }

  if (preFilter.rejected) {
    score -= 10000
    reasons.push(`hard_filter:${preFilter.flag}`)
  }

  score -= originalIndex / 1000

  return {
    job,
    originalIndex,
    preFilter,
    searchTermCoverageScore: coverage,
    priorityScore: score,
    priorityReasons: reasons,
  }
}

function dedupeAndRankLiveJobs(
  jobs: SearchJobResult[],
  config: BotConfig,
  safeTerms: string[]
): {
  jobs: LiveAuditJob[]
  duplicatesRemoved: number
  duplicateGroups: BotEvalLiveDuplicateGroup[]
} {
  const seenUrls = new Map<string, SearchJobResult>()
  const seenTitleCompany = new Map<string, SearchJobResult>()
  const duplicateGroups = new Map<string, BotEvalLiveDuplicateGroup>()
  const uniqueJobs: Array<{ job: SearchJobResult; originalIndex: number }> = []

  jobs.forEach((job, originalIndex) => {
    const urlKey = job.url?.trim() ? normalizeJobUrl(job.url) : ''
    const titleKey = companyTitleKey(job)
    const urlMatch = urlKey ? seenUrls.get(urlKey) : null
    const titleMatch = seenTitleCompany.get(titleKey)

    if (urlMatch) {
      addDuplicate(duplicateGroups, 'url', urlKey, urlMatch, job)
      return
    }

    if (titleMatch) {
      addDuplicate(duplicateGroups, 'company_title', titleKey, titleMatch, job)
      return
    }

    if (urlKey) seenUrls.set(urlKey, job)
    seenTitleCompany.set(titleKey, job)
    uniqueJobs.push({ job, originalIndex })
  })

  const rankedJobs = uniqueJobs
    .map(({ job, originalIndex }) =>
      livePriorityForJob(job, config, safeTerms, originalIndex, preFilterJob(job, config))
    )
    .sort((a, b) => b.priorityScore - a.priorityScore || a.originalIndex - b.originalIndex)

  return {
    jobs: rankedJobs,
    duplicatesRemoved: jobs.length - uniqueJobs.length,
    duplicateGroups: Array.from(duplicateGroups.values()),
  }
}

function reportFromEvaluation(
  candidate: LiveAuditJob,
  evaluation: JobEvaluation,
  scoringInputs: ScoringInputsSnapshot | null,
  outcome: BotEvalLiveJobOutcome,
  decisionReason: string
): BotEvalLiveJobReport {
  const { job } = candidate
  return {
    ...compactJob(job),
    outcome,
    decisionReason,
    evaluated: scoringInputs != null,
    score: evaluation.score,
    shouldApply: evaluation.shouldApply,
    flags: [...evaluation.flags],
    reasoning: evaluation.reasoning,
    resumeMatch: evaluation.resumeMatch ?? null,
    searchTermCoverageScore: candidate.searchTermCoverageScore,
    priorityScore: candidate.priorityScore,
    priorityReasons: candidate.priorityReasons,
    scoringInputs,
  }
}

function reportFromBudgetSkip(
  candidate: LiveAuditJob,
  maxAiEvals: number
): BotEvalLiveJobReport {
  const { job } = candidate
  return {
    ...compactJob(job),
    outcome: 'ai_budget_skipped',
    decisionReason: `Skipped OpenAI scoring because live dogfood maxAiEvals=${maxAiEvals} was reached.`,
    evaluated: false,
    score: null,
    shouldApply: null,
    flags: ['ai_budget_skipped'],
    reasoning: null,
    resumeMatch: null,
    searchTermCoverageScore: candidate.searchTermCoverageScore,
    priorityScore: candidate.priorityScore,
    priorityReasons: candidate.priorityReasons,
    scoringInputs: null,
  }
}

async function runLivePersona(
  persona: BotEvalPersonaFixture,
  options: BotEvalLiveOptions,
  deps: Required<BotEvalLiveDeps>
): Promise<BotEvalLivePersonaReport> {
  const candidateProfile = buildCandidateProfileFromSources({
    resumes: [persona.resume],
    applicationProfile: persona.applicationProfile,
    config: persona.config,
    jobTitle: persona.config.keywords[0] ?? persona.label,
  })
  const safeSearchProfile = buildSafeSearchProfile({
    config: persona.config,
    candidateProfile,
    maxTerms: Math.max(1, options.maxSearchTerms),
  })
  const searchConfig = searchConfigForLive(persona, options.maxLocations)
  const searchRequest = {
    ...buildBotSearchRequest(searchConfig, safeSearchProfile),
    results_wanted: options.maxSearchResults,
  }

  try {
    const { response: searchResponse, attempts: searchAttempts } = await runSearchWithRetry(
      searchRequest,
      options,
      deps
    )
    const jobs = searchResponse.jobs.slice(0, options.maxSearchResults)
    const preparedJobs = dedupeAndRankLiveJobs(jobs, persona.config, safeSearchProfile.terms)
    const reports: BotEvalLiveJobReport[] = []
    let aiEvaluated = 0

    for (const candidate of preparedJobs.jobs) {
      const { job, preFilter } = candidate
      if (preFilter.rejected) {
        reports.push(
          reportFromEvaluation(
            candidate,
            {
              score: preFilter.score,
              shouldApply: false,
              reasoning: preFilter.reason,
              flags: [preFilter.flag],
            },
            null,
            'hard_filtered',
            preFilter.reason
          )
        )
        continue
      }

      if (aiEvaluated >= options.maxAiEvals) {
        reports.push(reportFromBudgetSkip(candidate, options.maxAiEvals))
        continue
      }

      aiEvaluated++
      try {
        const result = await deps.evaluateJob(job, persona.config, candidateProfile)
        const outcome = result.evaluation.shouldApply ? 'would_save' : 'would_skip_low_score'
        reports.push(
          reportFromEvaluation(
            candidate,
            result.evaluation,
            result.scoringInputs,
            outcome,
            result.evaluation.shouldApply
              ? `Would save: score ${result.evaluation.score}/${persona.config.minScore}.`
              : `Would skip: score ${result.evaluation.score}/${persona.config.minScore}.`
          )
        )
      } catch (error) {
        reports.push({
          ...compactJob(job),
          outcome: 'eval_failed',
          decisionReason: error instanceof Error ? error.message : String(error),
          evaluated: false,
          score: null,
          shouldApply: null,
          flags: ['eval_failed'],
          reasoning: null,
          resumeMatch: null,
          searchTermCoverageScore: candidate.searchTermCoverageScore,
          priorityScore: candidate.priorityScore,
          priorityReasons: candidate.priorityReasons,
          scoringInputs: null,
        })
      }
    }

    const failureCounts = providerFailureCounts(searchResponse.meta)
    return {
      id: persona.id,
      label: persona.label,
      passed: reports.length > 0 && reports.every((job) => job.outcome !== 'eval_failed'),
      profileSource: {
        kind: candidateProfile.source.kind,
        label: candidateProfile.source.label,
        resumeId: candidateProfile.source.resumeId,
        resumeLabel: candidateProfile.source.resumeLabel,
      },
      safeTerms: safeSearchProfile.terms,
      searchRequest,
      searchMeta: searchResponse.meta,
      jobsFound: searchResponse.jobs.length,
      jobsAudited: reports.length,
      aiEvaluated,
      searchAttempts,
      duplicatesRemoved: preparedJobs.duplicatesRemoved,
      duplicateGroups: preparedJobs.duplicateGroups,
      providerFailureCount: failureCounts.total,
      providerThrottleFailureCount: failureCounts.throttle,
      providerTimeoutFailureCount: failureCounts.timeout,
      providerFailures: providerFailuresFromMeta(searchResponse.meta),
      jobs: reports,
      error: null,
    }
  } catch (error) {
    return {
      id: persona.id,
      label: persona.label,
      passed: false,
      profileSource: {
        kind: candidateProfile.source.kind,
        label: candidateProfile.source.label,
        resumeId: candidateProfile.source.resumeId,
        resumeLabel: candidateProfile.source.resumeLabel,
      },
      safeTerms: safeSearchProfile.terms,
      searchRequest,
      searchMeta: null,
      jobsFound: 0,
      jobsAudited: 0,
      aiEvaluated: 0,
      searchAttempts: 0,
      duplicatesRemoved: 0,
      duplicateGroups: [],
      providerFailureCount: 0,
      providerThrottleFailureCount: 0,
      providerTimeoutFailureCount: 0,
      providerFailures: {},
      jobs: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runLiveBotEvalSuite(
  input: RunLiveBotEvalSuiteInput = {}
): Promise<BotEvalLiveReport> {
  const options = normalizeLiveDogfoodOptions(input.options)
  const personas = (input.personas ?? BOT_EVAL_PERSONAS).slice(0, options.maxPersonas)
  const deps: Required<BotEvalLiveDeps> = {
    runSearch: input.deps?.runSearch ?? defaultRunSearch,
    evaluateJob: input.deps?.evaluateJob ?? defaultEvaluateJobWithCandidateProfile,
    sleep: input.deps?.sleep ?? sleep,
  }

  const personaReports: BotEvalLivePersonaReport[] = []
  for (let i = 0; i < personas.length; i++) {
    if (i > 0 && options.providerCooldownMs > 0) {
      await deps.sleep(options.providerCooldownMs)
    }
    const persona = personas[i]
    personaReports.push(await runLivePersona(persona, options, deps))
  }

  const jobs = personaReports.flatMap((persona) => persona.jobs)
  const totals = {
    personas: personaReports.length,
    personasPassed: personaReports.filter((persona) => persona.passed).length,
    personasFailed: personaReports.filter((persona) => !persona.passed).length,
    jobsFound: personaReports.reduce((total, persona) => total + persona.jobsFound, 0),
    jobsAudited: personaReports.reduce((total, persona) => total + persona.jobsAudited, 0),
    aiEvaluated: personaReports.reduce((total, persona) => total + persona.aiEvaluated, 0),
    searchAttempts: personaReports.reduce((total, persona) => total + persona.searchAttempts, 0),
    duplicatesRemoved: personaReports.reduce((total, persona) => total + persona.duplicatesRemoved, 0),
    providerFailures: personaReports.reduce((total, persona) => total + persona.providerFailureCount, 0),
    providerThrottleFailures: personaReports.reduce(
      (total, persona) => total + persona.providerThrottleFailureCount,
      0
    ),
    providerTimeoutFailures: personaReports.reduce(
      (total, persona) => total + persona.providerTimeoutFailureCount,
      0
    ),
    wouldSave: jobs.filter((job) => job.outcome === 'would_save').length,
    wouldSkipLowScore: jobs.filter((job) => job.outcome === 'would_skip_low_score').length,
    hardFiltered: jobs.filter((job) => job.outcome === 'hard_filtered').length,
    aiBudgetSkipped: jobs.filter((job) => job.outcome === 'ai_budget_skipped').length,
    evalFailed: jobs.filter((job) => job.outcome === 'eval_failed').length,
  }

  return {
    mode: 'live-audit',
    auditOnly: true,
    createdAt: (input.now ?? new Date()).toISOString(),
    passed: totals.personasFailed === 0,
    options,
    totals,
    personas: personaReports,
  }
}

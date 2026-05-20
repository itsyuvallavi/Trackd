/**
 * Bot search orchestrator.
 *
 * Flow:
 * 1. Call the configured job search API via the unified client
 * 2. Deduplicate against existing jobs in the DB (by URL / title / batch)
 * 3. Save new jobs with status SAVED + source BOT or platform-specific
 * 4. Run AI evaluator on each new job
 * 5. Persist BotRunLog lines + BotRunListing audit rows (when botRunId set)
 */

import { JobSource, Prisma } from '@prisma/client'
import type { BotConfig } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SearchJobResult, OrchestratorResult } from './types'
import { evaluateJob } from './job-evaluator'
import { preFilterJob, type PreFilterResult } from './pre-filter'
import { runSearch } from './adapters/search-client'
import { botSearchHasQueryableBackend } from './bot-search-sources'
import { buildBotSearchRequest } from './search-request'
import {
  buildSafeSearchProfile,
  type SafeSearchProfile,
} from './search-profile'
import {
  loadCandidateProfileForEvaluation,
  resumeString,
  resumeStringArray,
  type CandidateProfile,
  type CandidateProfileSourceMetadata,
} from './candidate-profile'
import {
  countryTokensFromJobLocationLine,
  hasRemoteWorkSignal,
  jdLocationOverlapsUser,
  parseUserLocations,
} from './user-locations'
import {
  BOT_SEARCH_AI_EVAL_CONCURRENCY,
} from './search-constants'
import {
  BOT_LISTING_OUTCOME,
  BOT_LISTING_STAGE,
  compactJobForAudit,
  companyTitleKey,
  insertBotRunListings,
  normalizeJobUrl,
} from './bot-run-audit'
import {
  dismissedFingerprintForTitleCompany,
  dismissedFingerprintForUrl,
} from './dismissed-job-imports'

const REASONING_LOG_MAX = 280
const REASONING_STORE_MAX = 800

const EMPTY_PROFILE_SOURCE: CandidateProfileSourceMetadata = {
  kind: 'none',
  label: 'No profile source',
  resumeId: null,
  resumeLabel: null,
  parsedResumeUsed: false,
  rawResumeTextUsed: false,
  applicationIdentitySupplemented: false,
  settingsDerivedSignalsUsed: false,
  settingsSignals: [],
  limitations: [],
}

const EMPTY_SEARCH_PROFILE: SafeSearchProfile = {
  terms: [],
  resumeSearchTerms: [],
  settingsKeywords: [],
  derivedFromResume: false,
  profileSource: {
    kind: 'none',
    label: 'No profile source',
    resumeId: null,
    resumeLabel: null,
  },
}

function oneLineExcerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function metaToJson(meta: unknown): Prisma.InputJsonValue | undefined {
  if (meta === undefined || meta === null) return undefined
  if (typeof meta === 'string' || typeof meta === 'number' || typeof meta === 'boolean') {
    return meta
  }
  if (typeof meta === 'object') {
    return meta as Prisma.InputJsonValue
  }
  return String(meta)
}

function sourceToPrismaSource(source: string): JobSource {
  const map: Record<string, JobSource> = {
    indeed: JobSource.INDEED,
    linkedin: JobSource.LINKEDIN,
    linkedin_ljs: JobSource.LINKEDIN,
    jobs_search_api: JobSource.BOT,
    glassdoor: JobSource.OTHER,
    glassdoor_rt: JobSource.OTHER,
    zip_recruiter: JobSource.ZIPRECRUITER,
  }
  return map[source.toLowerCase()] ?? JobSource.BOT
}

function profileAuditSnapshot(profile: CandidateProfile | null): Prisma.InputJsonObject {
  const source = profile?.source ?? EMPTY_PROFILE_SOURCE
  const resume = profile?.resume ?? null

  return {
    profileSource: source as unknown as Prisma.InputJsonObject,
    resumeUsed: {
      resumeId: source.resumeId,
      label: source.resumeLabel,
      selection: source.kind,
      sourceKind: source.kind,
      sourceLabel: source.label,
      skillsSentToPrompt: resume ? resumeStringArray(resume.skills).slice(0, 30) : [],
      summaryIncluded: Boolean(resumeString(resume?.summary)),
      experienceRolesInPrompt: resume
        ? Math.min(4, Array.isArray(resume.experience) ? resume.experience.length : 0)
        : 0,
      educationRowsInPrompt: resume && Array.isArray(resume.education) ? resume.education.length : 0,
      applicationIdentitySupplemented: source.applicationIdentitySupplemented,
      settingsDerivedSignalsUsed: source.settingsDerivedSignalsUsed,
      settingsSignals: source.settingsSignals,
      limitations: source.limitations,
    },
  }
}

function searchProfileAuditSnapshot(
  searchProfile: SafeSearchProfile | null
): Prisma.InputJsonObject {
  const safeProfile = searchProfile ?? EMPTY_SEARCH_PROFILE

  return {
    searchProfile: {
      terms: safeProfile.terms,
      resumeSearchTerms: safeProfile.resumeSearchTerms,
      settingsKeywords: safeProfile.settingsKeywords,
      derivedFromResume: safeProfile.derivedFromResume,
      profileSource: safeProfile.profileSource,
    },
  }
}

function skippedScoringNote(
  stage: string,
  profile: CandidateProfile | null,
  searchProfile: SafeSearchProfile | null,
  extra?: Prisma.InputJsonObject
): Prisma.InputJsonValue {
  return {
    note: 'AI evaluator was not run for this listing.',
    filterStage: stage,
    ...profileAuditSnapshot(profile),
    ...searchProfileAuditSnapshot(searchProfile),
    ...(extra ?? {}),
  }
}

async function runLimited<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1))
  let next = 0

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const item = items[next++]
        await worker(item)
      }
    })
  )
}

function noOpenAiSnapshot(
  profile: CandidateProfile | null,
  priority?: CandidatePriority,
  searchProfile?: SafeSearchProfile | null
): Prisma.InputJsonValue {
  return {
    note: 'OPENAI_API_KEY was not set — listing saved without AI scoring.',
    gateway: 'none',
    ...profileAuditSnapshot(profile),
    ...searchProfileAuditSnapshot(searchProfile ?? null),
    ...(priority ? priorityAuditSnapshot(priority) : {}),
  }
}

function isPreFilterScoringInput(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { model?: unknown }).model === 'pre-filter'
  )
}

export type RunBotSearchOptions = {
  /** When set, pipeline log lines → BotRunLog; per-listing audit → BotRunListing. */
  botRunId?: string
}

type MutableListing = {
  finalized: boolean
  sequence: number
  importSource: string
  title: string
  company: string
  url: string | null
  jobSnapshot: Prisma.InputJsonValue
  minScoreAtRun: number
  stage: string
  outcome: string
  evaluated: boolean
  score: number | null
  shouldApply: boolean | null
  flags: string[]
  reasoning: string | null
  resumeMatch: string | null
  scoringInputs: Prisma.InputJsonValue | null
  decisionReason: string | null
  errorMessage: string | null
}

type JobWithAudit = {
  job: SearchJobResult
  seq: number
  audit: MutableListing
}

type CandidatePriority = {
  score: number
  reasons: string[]
}

type PrioritizedJobWithAudit = JobWithAudit & {
  priority: CandidatePriority
}

function normalizePriorityText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

function profileHasResumeEvidence(profile: CandidateProfile | null): boolean {
  return profile?.source.kind === 'parsed_resume' || profile?.source.kind === 'raw_resume_fallback'
}

function profileSkillText(profile: CandidateProfile | null): string {
  if (!profile?.resume) return ''
  const experienceText = Array.isArray(profile.resume.experience)
    ? profile.resume.experience
        .slice(0, 4)
        .map((entry) =>
          [
            resumeString(entry?.title),
            resumeString(entry?.company),
            resumeString(entry?.description),
          ].join(' ')
        )
        .join(' ')
    : ''

  return normalizePriorityText(
    [
      resumeStringArray(profile.resume.skills).join(' '),
      resumeString(profile.resume.summary),
      experienceText,
    ].join(' ')
  )
}

function priorityAuditSnapshot(priority: CandidatePriority): Prisma.InputJsonObject {
  return {
    budgetRanking: {
      priorityScore: priority.score,
      priorityReasons: priority.reasons,
    },
    priorityScore: priority.score,
    priorityReasons: priority.reasons,
  }
}

function enrichScoringInputsForAudit(
  scoringInputs: Prisma.InputJsonValue | null,
  profile: CandidateProfile | null,
  priority: CandidatePriority,
  searchProfile: SafeSearchProfile | null
): Prisma.InputJsonValue {
  const existing =
    scoringInputs && typeof scoringInputs === 'object' && !Array.isArray(scoringInputs)
      ? (scoringInputs as Prisma.InputJsonObject)
      : {}

  return {
    ...profileAuditSnapshot(profile),
    ...searchProfileAuditSnapshot(searchProfile),
    ...existing,
    ...priorityAuditSnapshot(priority),
  }
}

function resumeStackPriority(
  job: SearchJobResult,
  profile: CandidateProfile | null
): CandidatePriority {
  const profileText = profileSkillText(profile)
  if (!profileText) return { score: 0, reasons: [] }

  const resumeEvidence = profileHasResumeEvidence(profile)
  const strong = resumeEvidence ? 1 : 0.35
  const title = normalizePriorityText(job.title)
  const haystack = `${title} ${normalizePriorityText(job.description)}`.trim()
  const reasons: string[] = []
  let score = 0

  const hasFrontendResume = hasAnyPattern(profileText, [
    /\breact\b/,
    /\bnext js\b/,
    /\btypescript\b/,
    /\bjavascript\b/,
    /\bfrontend\b/,
    /\bfront end\b/,
    /\bcss\b/,
  ])
  const hasFrontendJob = hasAnyPattern(haystack, [
    /\breact\b/,
    /\bnext js\b/,
    /\bfrontend\b/,
    /\bfront end\b/,
    /\bui\b/,
    /\buser facing\b/,
    /\bweb engineering\b/,
    /\btypescript\b/,
    /\bjavascript\b/,
  ])

  if (hasFrontendResume && hasFrontendJob) {
    const titleBoost = hasAnyPattern(title, [/\bfrontend\b/, /\bfront end\b/, /\breact\b/, /\bweb\b/])
    score += Math.round((titleBoost ? 42 : 28) * strong)
    reasons.push(titleBoost ? 'resume_stack:frontend_title' : 'resume_stack:frontend')
  }

  const hasFullstackResume = hasAnyPattern(profileText, [
    /\bnext js\b/,
    /\bnode js\b/,
    /\brest apis?\b/,
    /\bprisma\b/,
    /\bpostgresql\b/,
    /\bsupabase\b/,
    /\bfirebase\b/,
  ])
  const hasFullstackJob = hasAnyPattern(haystack, [
    /\bfull stack\b/,
    /\bfullstack\b/,
    /\bapi\b/,
    /\bbackend\b/,
    /\bnode\b/,
    /\btypescript\b/,
    /\bpostgres\b/,
  ])

  if (hasFullstackResume && hasFullstackJob) {
    score += Math.round(24 * strong)
    reasons.push('resume_stack:typescript_fullstack')
  }

  const hasAiToolingResume = hasAnyPattern(profileText, [
    /\bllm\b/,
    /\blocal llms?\b/,
    /\bcontext retrieval\b/,
    /\bagentic\b/,
    /\beval harness/,
    /\bworkflow automation\b/,
    /\bdeveloper tooling\b/,
    /\bai tooling\b/,
  ])
  const hasAiToolingJob = hasAnyPattern(haystack, [
    /\bllm\b/,
    /\blarge language models?\b/,
    /\bagentic\b/,
    /\bai product\b/,
    /\bdeveloper experience\b/,
    /\bdeveloper tooling\b/,
    /\bworkflow automation\b/,
    /\bapplied ai\b/,
  ])

  if (hasAiToolingResume && hasAiToolingJob) {
    score += Math.round(26 * strong)
    reasons.push('resume_stack:ai_tooling')
  }

  return { score, reasons }
}

function mismatchPriority(
  job: SearchJobResult,
  botConfig: BotConfig,
  profile: CandidateProfile | null
): CandidatePriority {
  const profileText = profileSkillText(profile)
  if (!profileText) return { score: 0, reasons: [] }

  const resumeEvidence = profileHasResumeEvidence(profile)
  const multiplier = resumeEvidence ? 1 : 0.45
  const title = normalizePriorityText(job.title)
  const haystack = `${title} ${normalizePriorityText(job.description)}`.trim()
  const reasons: string[] = []
  let score = 0

  const lacks = (patterns: RegExp[]) => !hasAnyPattern(profileText, patterns)
  const addPenalty = (points: number, reason: string) => {
    score -= Math.round(points * multiplier)
    reasons.push(reason)
  }

  if (hasAnyPattern(haystack, [/\boutsystems?\b/]) && lacks([/\boutsystems?\b/])) {
    addPenalty(58, 'mismatch:outsystems')
  }

  if (
    hasAnyPattern(haystack, [/\bjava\b/, /\bspring boot\b/, /\bspring\b/]) &&
    lacks([/\bjava\b/, /\bspring\b/])
  ) {
    addPenalty(36, 'mismatch:java_spring')
  }

  if (
    hasAnyPattern(title, [/\bdata scientist\b/, /\bmachine learning engineer\b/, /\bml engineer\b/]) &&
    lacks([/\bpython\b/, /\bpytorch\b/, /\btensorflow\b/, /\bscikit\b/, /\bmachine learning\b/])
  ) {
    addPenalty(44, 'mismatch:classical_ml')
  } else if (
    hasAnyPattern(haystack, [/\bpytorch\b/, /\btensorflow\b/, /\bscikit\b/, /\bpandas\b/, /\bnumpy\b/]) &&
    lacks([/\bpython\b/, /\bpytorch\b/, /\btensorflow\b/, /\bscikit\b/])
  ) {
    addPenalty(30, 'mismatch:python_ml_stack')
  }

  if (hasAnyPattern(haystack, [/\bdatabricks\b/]) && lacks([/\bdatabricks\b/])) {
    addPenalty(30, 'mismatch:databricks')
  }

  if (
    hasAnyPattern(haystack, [/\bkotlin\b/]) &&
    hasAnyPattern(title, [/\bbackend\b/, /\bserver\b/]) &&
    lacks([/\bkotlin\b/])
  ) {
    addPenalty(28, 'mismatch:kotlin_backend')
  }

  if (
    hasAnyPattern(haystack, [/\bsiem\b/, /\breverse engineering\b/, /\bmalware\b/, /\bweb security\b/]) &&
    lacks([/\bsecurity\b/, /\bsiem\b/, /\breverse engineering\b/])
  ) {
    addPenalty(24, 'mismatch:security_specialty')
  }

  if (
    hasAnyPattern(haystack, [/\bhardware\b/, /\bembedded\b/, /\bdevice\b/]) &&
    lacks([/\bhardware\b/, /\bembedded\b/, /\bdevice\b/])
  ) {
    addPenalty(24, 'mismatch:hardware_systems')
  }

  const primaryNonResumeStack =
    hasAnyPattern(title, [/\bphp\b/, /\b\.net\b/, /\bdotnet\b/, /\bc#\b/, /\bruby\b/, /\bgolang\b/, /\bgo developer\b/]) ||
    hasAnyPattern(haystack, [/\bphp\b/, /\b\.net\b/, /\bdotnet\b/, /\bc#\b/, /\bruby\b/, /\bgolang\b/])
  if (
    primaryNonResumeStack &&
    lacks([/\bphp\b/, /\b\.net\b/, /\bdotnet\b/, /\bc#\b/, /\bruby\b/, /\bgolang\b/])
  ) {
    addPenalty(24, 'mismatch:primary_backend_ecosystem')
  }

  const preferred = (botConfig.experienceLevel ?? '').toLowerCase()
  const userTargetsJuniorOrMid = preferred.includes('junior') || preferred.includes('entry') || preferred.includes('mid')
  if (
    userTargetsJuniorOrMid &&
    hasAnyPattern(title, [/\blead\b/, /\bprincipal\b/, /\bstaff\b/, /\btech lead\b/, /\bhead of\b/])
  ) {
    addPenalty(26, 'seniority:lead_title')
  } else if (
    userTargetsJuniorOrMid &&
    hasAnyPattern(title, [/\bsenior\b/, /\bsr\b/])
  ) {
    addPenalty(14, 'seniority:senior_title')
  }

  return { score, reasons }
}

function keywordPriority(job: SearchJobResult, botConfig: BotConfig): CandidatePriority {
  const title = normalizePriorityText(job.title)
  const haystack = `${title} ${normalizePriorityText(job.description)}`.trim()
  const reasons: string[] = []
  let score = 0
  let tokenHits = 0

  for (const rawKeyword of botConfig.keywords) {
    const keyword = normalizePriorityText(rawKeyword)
    if (!keyword) continue

    if (title.includes(keyword)) {
      score += 30
      reasons.push(`title_phrase:${rawKeyword}`)
      continue
    }

    const tokens = keyword
      .split(' ')
      .filter((token) => token.length >= 3)
      .filter((token) => !['developer', 'engineer', 'software', 'role', 'job'].includes(token))

    for (const token of tokens) {
      if (haystack.includes(token)) {
        tokenHits++
        reasons.push(`keyword:${token}`)
      }
    }
  }

  if (tokenHits > 0) {
    score += Math.min(32, tokenHits * 8)
  }

  return { score, reasons }
}

function locationPriority(job: SearchJobResult, botConfig: BotConfig): CandidatePriority {
  const user = parseUserLocations(botConfig.locations)
  if (user.isAny) {
    return { score: 5, reasons: ['location:any'] }
  }

  const reasons: string[] = []
  let score = 0
  const location = job.location ?? ''
  const locationTokens = countryTokensFromJobLocationLine(location)

  if (locationTokens.length > 0 && jdLocationOverlapsUser(locationTokens, user)) {
    score += 30
    reasons.push('location:target_region')
  }

  const locText = normalizePriorityText(location)
  for (const city of user.cities) {
    if (city.length >= 3 && locText.includes(city)) {
      score += 24
      reasons.push(`location:city:${city}`)
      break
    }
  }

  const remoteSignal =
    job.is_remote === true ||
    hasRemoteWorkSignal(job.title) ||
    hasRemoteWorkSignal(location) ||
    hasRemoteWorkSignal(job.description)

  if (
    remoteSignal &&
    (botConfig.remoteOnly || user.hasRemoteToken || user.hasEuropeToken || user.hasEuToken)
  ) {
    score += 35
    reasons.push('location:remote_signal')
  }

  return { score, reasons }
}

function qualityPriority(job: SearchJobResult): CandidatePriority {
  const reasons: string[] = []
  let score = 0
  const descriptionLength = (job.description ?? '').trim().length

  if (descriptionLength >= 400) {
    score += 18
    reasons.push('description:substantial')
  } else if (descriptionLength >= 80) {
    score += 10
    reasons.push('description:usable')
  } else {
    score -= 8
    reasons.push('description:thin')
  }

  if (job.salary_min || job.salary_max) {
    score += 4
    reasons.push('salary:present')
  }

  const board = (job.jobBoard ?? job.source ?? '').toLowerCase()
  if (['linkedin', 'indeed', 'glassdoor'].includes(board)) {
    score += 4
    reasons.push(`board:${board}`)
  } else if (['naukri', 'bayt', 'dice', 'ziprecruiter', 'zip_recruiter'].includes(board)) {
    score -= 6
    reasons.push(`board:lower_priority:${board}`)
  }

  return { score, reasons }
}

function prioritizeCandidateWithProfile(
  job: SearchJobResult,
  botConfig: BotConfig,
  profile: CandidateProfile | null
): CandidatePriority {
  const parts = [
    resumeStackPriority(job, profile),
    mismatchPriority(job, botConfig, profile),
    keywordPriority(job, botConfig),
    locationPriority(job, botConfig),
    qualityPriority(job),
  ]

  return {
    score: parts.reduce((sum, part) => sum + part.score, 0),
    reasons: parts.flatMap((part) => part.reasons).slice(0, 12),
  }
}

function sortCandidatesForEvaluation(
  candidates: JobWithAudit[],
  botConfig: BotConfig,
  profile: CandidateProfile | null
): PrioritizedJobWithAudit[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      priority: prioritizeCandidateWithProfile(candidate.job, botConfig, profile),
    }))
    .sort((a, b) => {
      const byPriority = b.priority.score - a.priority.score
      if (byPriority !== 0) return byPriority
      return a.seq - b.seq
    })
}

function toCreateInput(botRunId: string, m: MutableListing): Prisma.BotRunListingCreateManyInput {
  return {
    botRunId,
    sequence: m.sequence,
    importSource: m.importSource,
    stage: m.stage,
    outcome: m.outcome,
    title: m.title,
    company: m.company,
    url: m.url,
    jobSnapshot: m.jobSnapshot,
    minScoreAtRun: m.minScoreAtRun,
    evaluated: m.evaluated,
    score: m.score,
    shouldApply: m.shouldApply,
    flags: m.flags,
    reasoning: m.reasoning,
    resumeMatch: m.resumeMatch,
    scoringInputs: m.scoringInputs ?? undefined,
    decisionReason: m.decisionReason,
    errorMessage: m.errorMessage,
  }
}

export async function runBotSearch(
  botConfig: BotConfig,
  userId: string,
  opts?: RunBotSearchOptions
): Promise<OrchestratorResult> {
  type LogLevel = 'info' | 'warn' | 'error'
  const runLogs: { seq: number; level: LogLevel; message: string; meta?: Prisma.InputJsonValue }[] = []
  let logSeq = 0

  const pushLog = (level: LogLevel, message: string, meta?: unknown) => {
    const jsonMeta = metaToJson(meta)
    const row = {
      seq: logSeq++,
      level,
      message,
      ...(jsonMeta !== undefined ? { meta: jsonMeta } : {}),
    }
    runLogs.push(row)
    if (level === 'info') console.log('[bot]', message)
    else if (level === 'warn') console.warn('[bot]', message, meta ?? '')
    else console.error('[bot]', message, meta ?? '')
  }

  const persistLogs = async () => {
    const id = opts?.botRunId
    if (!id || runLogs.length === 0) return
    try {
      await prisma.botRunLog.createMany({
        data: runLogs.map((l) => ({
          botRunId: id,
          sequence: l.seq,
          level: l.level,
          message: l.message,
          ...(l.meta !== undefined ? { meta: l.meta } : {}),
        })),
      })
    } catch (e) {
      console.error('[bot] Failed to persist BotRunLog rows:', e)
    }
  }

  const auditBySeq = new Map<number, MutableListing>()
  let auditFinished = false

  const persistListingAudit = async () => {
    const id = opts?.botRunId
    if (!id || !auditFinished || auditBySeq.size === 0) return
    const rows: Prisma.BotRunListingCreateManyInput[] = []
    const sortedKeys = [...auditBySeq.keys()].sort((a, b) => a - b)
    for (const k of sortedKeys) {
      const m = auditBySeq.get(k)!
      if (!m.finalized) {
        console.error(`[bot] Audit row seq=${k} not finalized — skipping DB insert for this sequence`)
        continue
      }
      rows.push(toCreateInput(id, m))
    }
    try {
      await insertBotRunListings(rows)
    } catch (e) {
      console.error('[bot] Failed to persist BotRunListing rows:', e)
    }
  }

  const result: OrchestratorResult = {
    jobsFound: 0,
    jobsNew: 0,
    jobsEvaluated: 0,
    jobsApproved: 0,
    jobsEvaluationFailed: 0,
    jobsSaveFailed: 0,
    jobsHardFiltered: 0,
    jobsSkippedLowScore: 0,
    skippedExistingByUrl: 0,
    skippedExistingByTitle: 0,
    skippedBatchDuplicate: 0,
    skippedPreviouslyDismissed: 0,
    errors: {},
    evaluationSkips: [],
    evaluationFailures: [],
    platformsMeta: null,
  }

  try {
    if (!botSearchHasQueryableBackend()) {
      result.errors['config'] =
        'No search backend available for current env / BOT_SEARCH_SOURCES — set JOBS_SEARCH_API_KEY.'
      result.fatalError = result.errors['config']
      pushLog('warn', result.errors['config'])
      return result
    }

    const runProfile = await loadCandidateProfileForEvaluation(
      userId,
      botConfig.keywords[0] ?? 'Job Search',
      botConfig
    )
    const safeSearchProfile = buildSafeSearchProfile({
      config: botConfig,
      candidateProfile: runProfile,
    })

    pushLog('info', 'Candidate profile source prepared for search ranking', {
      kind: runProfile.source.kind,
      label: runProfile.source.label,
      resumeId: runProfile.source.resumeId,
      resumeLabel: runProfile.source.resumeLabel,
      applicationIdentitySupplemented: runProfile.source.applicationIdentitySupplemented,
      settingsDerivedSignalsUsed: runProfile.source.settingsDerivedSignalsUsed,
    })
    pushLog('info', 'Safe search profile prepared', {
      terms: safeSearchProfile.terms,
      resumeSearchTerms: safeSearchProfile.resumeSearchTerms,
      settingsKeywords: safeSearchProfile.settingsKeywords,
      derivedFromResume: safeSearchProfile.derivedFromResume,
      profileSource: safeSearchProfile.profileSource,
    })

    const searchRequest = buildBotSearchRequest(botConfig, safeSearchProfile)

    pushLog('info', 'Search request built from /settings/bot and safe profile', {
      keywords: searchRequest.keywords,
      locations: searchRequest.locations,
      remote_only: searchRequest.remote_only,
      experience_level: searchRequest.experience_level ?? null,
      exclude_companies_count: searchRequest.exclude_companies?.length ?? 0,
      exclude_keywords_count: searchRequest.exclude_keywords?.length ?? 0,
      spoken_languages: botConfig.spokenLanguages ?? [],
      min_score: botConfig.minScore,
      search_profile_source: safeSearchProfile.profileSource,
      search_profile_derived_from_resume: safeSearchProfile.derivedFromResume,
    })

    let searchResponse
    try {
      searchResponse = await runSearch(searchRequest)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors['search'] = msg
      result.fatalError = msg
      pushLog('error', `Search failed: ${msg}`)
      return result
    }

    result.jobsFound = searchResponse.jobs.length
    result.platformsMeta = searchResponse.meta

    pushLog(
      'info',
      `Search complete: ${searchResponse.jobs.length} jobs from [${searchResponse.meta.platforms_succeeded.join(', ')}]`
    )
    pushLog(
      'info',
      `Raw rows by source (before exclude filters): ${JSON.stringify(searchResponse.meta.by_source_raw)}`
    )

    if (searchResponse.meta.platforms_failed && Object.keys(searchResponse.meta.platforms_failed).length > 0) {
      pushLog('warn', 'Platform issues', searchResponse.meta.platforms_failed)
    }

    if (
      searchResponse.jobs.length === 0 &&
      searchResponse.meta.platforms_succeeded.length === 0 &&
      Object.keys(searchResponse.meta.platforms_failed).length > 0
    ) {
      const details = Object.values(searchResponse.meta.platforms_failed).join('; ')
      result.errors['search'] = `All configured search providers failed: ${details}`
      result.fatalError = result.errors['search']
      pushLog('error', result.errors['search'])
      return result
    }

    if (searchResponse.jobs.length === 0) {
      pushLog('info', 'Search returned zero listings — nothing to deduplicate or evaluate.')
      return result
    }

    const jobsWithUrls = searchResponse.jobs.filter((j) => j.url?.trim())
    const urls = jobsWithUrls.map((j) => j.url!.trim().replace(/\/$/, ''))

    const verboseDedup =
      process.env.TRACKD_BOT_SEARCH_VERBOSE === '1' ||
      process.env.TRACKD_BOT_SEARCH_VERBOSE === 'true'

    // Scoped dedup: only fetch existing jobs whose company appears in the
    // current batch. Previously we loaded every job the user had, which grows
    // linearly with user history and dwarfed the search cost for power users.
    const batchCompanies = Array.from(
      new Set(
        searchResponse.jobs
          .map((j) => j.company?.trim())
          .filter((c): c is string => Boolean(c)),
      ),
    )

    const [existingJobs, existingJobsForDedup, dismissedRows] = await Promise.all([
      prisma.job.findMany({
        where: { userId, url: { in: urls } },
        select: { url: true, status: true },
      }),
      batchCompanies.length
        ? prisma.job.findMany({
            where: {
              userId,
              OR: batchCompanies.map((company) => ({
                company: { equals: company, mode: 'insensitive' as const },
              })),
            },
            select: { company: true, title: true },
          })
        : Promise.resolve(
            [] as { company: string; title: string }[],
          ),
      prisma.dismissedJobImport.findMany({
        where: { userId },
        select: { fingerprint: true },
      }),
    ])

    const existingUrls = new Set(
      existingJobs.map((j) => j.url?.trim().replace(/\/$/, '') ?? '').filter(Boolean)
    )

    const existingTitleKeys = new Set(
      existingJobsForDedup.map((j) => companyTitleKey({ company: j.company, title: j.title })),
    )
    const dismissedFp = new Set(dismissedRows.map((r) => r.fingerprint))

    const seenInBatch = new Set<string>()
    const newJobs: SearchJobResult[] = []
    const urlToSeq = new Map<string, number>()
    const noUrlSeqOrdered: number[] = []

    const baseMutable = (job: SearchJobResult, seq: number): Omit<MutableListing, 'finalized'> => ({
      sequence: seq,
      importSource: job.source || 'unknown',
      title: job.title.slice(0, 500),
      company: job.company.slice(0, 300),
      url: job.url?.slice(0, 2000) ?? null,
      jobSnapshot: compactJobForAudit(job),
      minScoreAtRun: botConfig.minScore,
      stage: BOT_LISTING_STAGE.SAVED,
      outcome: BOT_LISTING_OUTCOME.ACCEPTED,
      evaluated: false,
      score: null,
      shouldApply: null,
      flags: [],
      reasoning: null,
      resumeMatch: null,
      scoringInputs: null,
      decisionReason: null,
      errorMessage: null,
    })

    for (let seq = 0; seq < searchResponse.jobs.length; seq++) {
      const job = searchResponse.jobs[seq]
      const rawUrl = job.url?.trim() ?? ''
      const normalizedUrl = rawUrl ? normalizeJobUrl(rawUrl) : ''

      if (!rawUrl) {
        if (dismissedFp.has(dismissedFingerprintForTitleCompany(job))) {
          result.skippedPreviouslyDismissed++
          auditBySeq.set(seq, {
            ...baseMutable(job, seq),
            finalized: true,
            stage: BOT_LISTING_STAGE.DEDUP_DISMISSED,
            outcome: BOT_LISTING_OUTCOME.SKIPPED,
            scoringInputs: skippedScoringNote(
              BOT_LISTING_STAGE.DEDUP_DISMISSED,
              runProfile,
              safeSearchProfile
            ),
            decisionReason: 'You removed this listing earlier — it will not be re-imported.',
          })
          continue
        }
      } else if (
        dismissedFp.has(dismissedFingerprintForUrl(job.url!)) ||
        dismissedFp.has(dismissedFingerprintForTitleCompany(job))
      ) {
        result.skippedPreviouslyDismissed++
        if (verboseDedup) {
          pushLog('info', `Dedup dismissed (deleted earlier): ${job.title} @ ${job.company} — ${normalizedUrl}`)
        }
        auditBySeq.set(seq, {
          ...baseMutable(job, seq),
          finalized: true,
          stage: BOT_LISTING_STAGE.DEDUP_DISMISSED,
          outcome: BOT_LISTING_OUTCOME.SKIPPED,
          scoringInputs: skippedScoringNote(
            BOT_LISTING_STAGE.DEDUP_DISMISSED,
            runProfile,
            safeSearchProfile
          ),
          decisionReason: 'You removed this listing earlier — it will not be re-imported.',
        })
        continue
      }

      if (rawUrl && existingUrls.has(normalizedUrl)) {
        result.skippedExistingByUrl++
        if (verboseDedup) {
          pushLog('info', `Dedup URL (already in DB): ${job.title} @ ${job.company} — ${normalizedUrl}`)
        }
        auditBySeq.set(seq, {
          ...baseMutable(job, seq),
          finalized: true,
          stage: BOT_LISTING_STAGE.DEDUP_URL,
          outcome: BOT_LISTING_OUTCOME.SKIPPED,
          scoringInputs: skippedScoringNote(
            BOT_LISTING_STAGE.DEDUP_URL,
            runProfile,
            safeSearchProfile
          ),
          decisionReason: 'Same URL already exists in your job tracker.',
        })
        continue
      }

      const key = companyTitleKey(job)
      if (existingTitleKeys.has(key)) {
        result.skippedExistingByTitle++
        if (verboseDedup) {
          pushLog('info', `Dedup title+company (already in DB): ${job.title} @ ${job.company}`)
        } else {
          pushLog('info', `Skipping existing: ${job.title} @ ${job.company}`)
        }
        auditBySeq.set(seq, {
          ...baseMutable(job, seq),
          finalized: true,
          stage: BOT_LISTING_STAGE.DEDUP_TITLE,
          outcome: BOT_LISTING_OUTCOME.SKIPPED,
          scoringInputs: skippedScoringNote(
            BOT_LISTING_STAGE.DEDUP_TITLE,
            runProfile,
            safeSearchProfile
          ),
          decisionReason: 'Same company + title already in your tracker (URL may differ).',
        })
        continue
      }

      if (seenInBatch.has(key)) {
        result.skippedBatchDuplicate++
        if (verboseDedup) {
          pushLog('info', `Dedup batch (duplicate in this run): ${job.title} @ ${job.company}`)
        } else {
          pushLog('info', `Skipping batch duplicate: ${job.title} @ ${job.company}`)
        }
        auditBySeq.set(seq, {
          ...baseMutable(job, seq),
          finalized: true,
          stage: BOT_LISTING_STAGE.DEDUP_BATCH,
          outcome: BOT_LISTING_OUTCOME.SKIPPED,
          scoringInputs: skippedScoringNote(
            BOT_LISTING_STAGE.DEDUP_BATCH,
            runProfile,
            safeSearchProfile
          ),
          decisionReason: 'Duplicate company + title within this search result set.',
        })
        continue
      }

      seenInBatch.add(key)
      if (rawUrl) {
        urlToSeq.set(normalizedUrl, seq)
      } else {
        noUrlSeqOrdered.push(seq)
      }
      auditBySeq.set(seq, {
        ...baseMutable(job, seq),
        finalized: false,
        stage: 'awaiting_eval',
        outcome: 'pending',
      })
      newJobs.push(job)
    }

    const dedupTotal =
      result.skippedExistingByUrl +
      result.skippedExistingByTitle +
      result.skippedBatchDuplicate +
      result.skippedPreviouslyDismissed
    pushLog(
      'info',
      `Dedup vs DB & batch: ${dedupTotal} skipped ` +
        `(url=${result.skippedExistingByUrl} title=${result.skippedExistingByTitle} batch=${result.skippedBatchDuplicate} dismissed=${result.skippedPreviouslyDismissed}), ` +
        `${newJobs.length} new listings to evaluate (min score ${botConfig.minScore})`
    )

    const allNewJobs: SearchJobResult[] = newJobs

    if (allNewJobs.length === 0) {
      pushLog('info', `No new jobs for user ${userId} — all already tracked or duplicate in batch`)
      auditFinished = true
      return result
    }

    pushLog(
      'info',
      `Evaluating up to ${allNewJobs.length} listing(s) for user ${userId} (OpenAI saves only if score ≥ ${botConfig.minScore})`
    )

    let noUrlIdx = 0
    const openAi = !!process.env.OPENAI_API_KEY
    const jobsWithAudit: JobWithAudit[] = []
    for (const job of allNewJobs) {
      let seq: number | undefined
      if (job.url?.trim()) {
        seq = urlToSeq.get(normalizeJobUrl(job.url!))
      } else {
        seq = noUrlSeqOrdered[noUrlIdx++]
      }
      if (seq === undefined) {
        pushLog('error', `Internal: could not resolve audit sequence for "${job.title}" @ ${job.company}`)
        continue
      }

      const audit = auditBySeq.get(seq)
      if (!audit) {
        pushLog('error', `Internal: missing audit bucket for seq ${seq}`)
        continue
      }

      jobsWithAudit.push({ job, seq, audit })
    }

    const finalizePreFilteredCandidate = (
      { job, seq, audit }: JobWithAudit,
      preFilter: Extract<PreFilterResult, { rejected: true }>
    ) => {
      const priority = prioritizeCandidateWithProfile(job, botConfig, runProfile)
      result.jobsHardFiltered++
      result.jobsSkippedLowScore++
      result.evaluationSkips.push({
        title: job.title.slice(0, 200),
        company: job.company.slice(0, 120),
        score: preFilter.score,
        minScore: botConfig.minScore,
        flags: [preFilter.flag],
        reasoning: preFilter.reason.slice(0, REASONING_STORE_MAX),
        filterKind: 'hard_filter',
        priorityScore: priority.score,
        priorityReasons: priority.reasons,
        jobBoard: job.jobBoard ?? null,
        providerPass: job.providerPass ?? null,
      })
      pushLog(
        'info',
        `Hard filter rejected before AI scoring (not saved): ${job.title} @ ${job.company} — ` +
          `${preFilter.flag} | ${oneLineExcerpt(preFilter.reason, REASONING_LOG_MAX)}`
      )
      auditBySeq.set(seq, {
        ...audit,
        finalized: true,
        stage: BOT_LISTING_STAGE.HARD_FILTER,
        outcome: BOT_LISTING_OUTCOME.REJECTED,
        evaluated: false,
        score: preFilter.score,
        shouldApply: false,
        flags: [preFilter.flag],
        reasoning: preFilter.reason,
        resumeMatch: null,
        scoringInputs: {
          model: 'pre-filter',
          note: 'Deterministic hard filter ran before AI scoring.',
          deterministicFilter: preFilter.flag,
          ...profileAuditSnapshot(runProfile),
          ...searchProfileAuditSnapshot(safeSearchProfile),
          ...priorityAuditSnapshot(priority),
        },
        decisionReason: preFilter.reason,
      })
    }

    const aiEvalConcurrency = BOT_SEARCH_AI_EVAL_CONCURRENCY
    const aiEligibleJobs: JobWithAudit[] = []

    if (openAi) {
      for (const candidate of jobsWithAudit) {
        const preFilter = preFilterJob(candidate.job, botConfig)
        if (preFilter.rejected) {
          finalizePreFilteredCandidate(candidate, preFilter)
        } else {
          aiEligibleJobs.push(candidate)
        }
      }
    } else {
      aiEligibleJobs.push(...jobsWithAudit)
    }

    if (openAi && aiEligibleJobs.length !== jobsWithAudit.length) {
      pushLog(
        'info',
        `AI pre-filter: ${jobsWithAudit.length - aiEligibleJobs.length} hard-filtered, ` +
          `${aiEligibleJobs.length} eligible for AI ranking.`
      )
    }

    const prioritizedJobs = openAi
      ? sortCandidatesForEvaluation(aiEligibleJobs, botConfig, runProfile)
      : aiEligibleJobs.map((candidate) => ({
          ...candidate,
          priority: { score: 0, reasons: [] },
        }))
    const jobsToProcess = prioritizedJobs

    if (openAi && prioritizedJobs.length > 0) {
      const preview = prioritizedJobs.slice(0, Math.min(5, prioritizedJobs.length)).map((item) => ({
        seq: item.seq,
        title: item.job.title.slice(0, 120),
        company: item.job.company.slice(0, 80),
        priorityScore: item.priority.score,
        reasons: item.priority.reasons,
      }))
      pushLog('info', 'AI evaluation priority order prepared', {
        eligible: prioritizedJobs.length,
        evaluationsPlanned: prioritizedJobs.length,
        preview,
      })
    }

    const processJob = async ({
      job,
      seq,
      audit,
      priority,
    }: {
      job: SearchJobResult
      seq: number
      audit: MutableListing
      priority: CandidatePriority
    }) => {
      try {
        let score = 0
        let shouldApply = false
        let reasoning = ''
        let flags: string[] = []
        let evaluated = false
        let hardFiltered = false
        let resumeMatch: string | null = null
        let scoringInputs: Prisma.InputJsonValue | null = null

        if (openAi) {
          try {
            const { evaluation, scoringInputs: si } = await evaluateJob(job, botConfig)
            score = evaluation.score
            shouldApply = evaluation.shouldApply
            reasoning = evaluation.reasoning
            flags = evaluation.flags
            resumeMatch = evaluation.resumeMatch ?? null
            hardFiltered = isPreFilterScoringInput(si)
            scoringInputs = enrichScoringInputsForAudit(
              si as unknown as Prisma.InputJsonValue,
              runProfile,
              priority,
              safeSearchProfile
            )
            evaluated = !hardFiltered
            if (hardFiltered) {
              result.jobsHardFiltered++
            } else {
              result.jobsEvaluated++
            }
          } catch (evalErr) {
            const errMsg = evalErr instanceof Error ? evalErr.message : String(evalErr)
            pushLog('warn', `Eval failed for "${job.title}"`, errMsg)
            result.jobsEvaluationFailed++
            result.evaluationFailures.push({
              title: job.title.slice(0, 200),
              company: job.company.slice(0, 120),
              error: errMsg.slice(0, REASONING_STORE_MAX),
            })
            auditBySeq.set(seq, {
              ...audit,
              finalized: true,
              stage: BOT_LISTING_STAGE.EVAL_FAILED,
              outcome: BOT_LISTING_OUTCOME.REJECTED,
              evaluated: false,
              score: null,
              shouldApply: null,
              flags: [],
              reasoning: null,
              resumeMatch: null,
              scoringInputs: {
                note: 'Evaluator threw before completing.',
                error: errMsg.slice(0, 2000),
                ...profileAuditSnapshot(runProfile),
                ...searchProfileAuditSnapshot(safeSearchProfile),
                ...priorityAuditSnapshot(priority),
              },
              decisionReason: 'AI evaluation failed — listing not saved.',
              errorMessage: errMsg.slice(0, 4000),
            })
            return
          }
        } else {
          const preFilter = preFilterJob(job, botConfig)
          if (preFilter.rejected) {
            result.jobsHardFiltered++
            result.jobsSkippedLowScore++
            result.evaluationSkips.push({
              title: job.title.slice(0, 200),
              company: job.company.slice(0, 120),
              score: preFilter.score,
              minScore: botConfig.minScore,
              flags: [preFilter.flag],
              reasoning: preFilter.reason.slice(0, REASONING_STORE_MAX),
              filterKind: 'hard_filter',
              priorityScore: priority.score,
              priorityReasons: priority.reasons,
              jobBoard: job.jobBoard ?? null,
              providerPass: job.providerPass ?? null,
            })
            pushLog(
              'info',
              `Deterministic filter rejected (not saved): ${job.title} @ ${job.company} — ${preFilter.flag} | ${oneLineExcerpt(preFilter.reason, REASONING_LOG_MAX)}`
            )
            auditBySeq.set(seq, {
              ...audit,
              finalized: true,
              stage: BOT_LISTING_STAGE.HARD_FILTER,
              outcome: BOT_LISTING_OUTCOME.REJECTED,
              evaluated: false,
              score: preFilter.score,
              shouldApply: false,
              flags: [preFilter.flag],
              reasoning: preFilter.reason,
              resumeMatch: null,
              scoringInputs: {
                note: 'OPENAI_API_KEY was not set — deterministic pre-filter ran before save.',
                gateway: 'none',
                deterministicFilter: preFilter.flag,
                ...profileAuditSnapshot(runProfile),
                ...searchProfileAuditSnapshot(safeSearchProfile),
                ...priorityAuditSnapshot(priority),
              },
              decisionReason: preFilter.reason,
            })
            return
          }
          scoringInputs = noOpenAiSnapshot(runProfile, priority, safeSearchProfile)
        }

        if ((evaluated || hardFiltered) && !shouldApply) {
          result.jobsSkippedLowScore++
          const minS = botConfig.minScore
          const filterKind = hardFiltered ? 'hard_filter' : 'ai_score'
          result.evaluationSkips.push({
            title: job.title.slice(0, 200),
            company: job.company.slice(0, 120),
            score,
            minScore: minS,
            flags,
            reasoning: reasoning.slice(0, REASONING_STORE_MAX),
            resumeMatch: resumeMatch ?? undefined,
            filterKind,
            priorityScore: priority.score,
            priorityReasons: priority.reasons,
            jobBoard: job.jobBoard ?? null,
            providerPass: job.providerPass ?? null,
          })
          const flagStr = flags.length ? flags.join(', ') : 'none'
          pushLog(
            'info',
            hardFiltered
              ? `Hard filter rejected (not saved): ${job.title} @ ${job.company} — score ${score}/${minS} | flags: ${flagStr} | ${oneLineExcerpt(reasoning, REASONING_LOG_MAX)}`
              : `Below AI threshold (not saved): ${job.title} @ ${job.company} — score ${score}/${minS} | flags: ${flagStr} | ${oneLineExcerpt(reasoning, REASONING_LOG_MAX)}`
          )
          auditBySeq.set(seq, {
            ...audit,
            finalized: true,
            stage: hardFiltered ? BOT_LISTING_STAGE.HARD_FILTER : BOT_LISTING_STAGE.BELOW_THRESHOLD,
            outcome: BOT_LISTING_OUTCOME.REJECTED,
            evaluated,
            score,
            shouldApply: false,
            flags,
            reasoning,
            resumeMatch,
            scoringInputs,
            decisionReason: hardFiltered
              ? reasoning || `Deterministic filter rejected this listing before AI scoring.`
              : `AI score ${score} is below your minimum (${minS}).`,
          })
          return
        }

        let salary: string | undefined
        if (job.salary_min || job.salary_max) {
          const currency = job.salary_currency || 'USD'
          salary =
            job.salary_min && job.salary_max
              ? `${currency} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`
              : `${currency} ${(job.salary_min || job.salary_max)!.toLocaleString()}`
        }

        const tags = ['bot-found']
        if (shouldApply && evaluated) tags.push('bot-approved')
        if (job.is_remote) tags.push('remote')

        await prisma.job.create({
          data: {
            userId,
            title: job.title,
            company: job.company,
            location: job.location ?? null,
            url: job.url ?? null,
            importSource: job.source || null,
            importJobBoard: job.jobBoard?.trim() || null,
            source: sourceToPrismaSource(job.source),
            salary,
            tags,
            botScore: score > 0 ? score : null,
            botReasoning: reasoning || null,
            activities: {
              create: {
                userId,
                type: 'NOTE',
                description: `Bot found via ${job.source}${score > 0 ? ` · AI score ${score}/100` : ''}`,
              },
            },
          },
        })
        result.jobsNew++
        if (evaluated && shouldApply) {
          result.jobsApproved++
          const flagStr = flags.length ? flags.join(', ') : 'none'
          pushLog(
            'info',
            `Saved (meets threshold): ${job.title} @ ${job.company} — score ${score}/${botConfig.minScore} | flags: ${flagStr} | ${oneLineExcerpt(reasoning, REASONING_LOG_MAX)}`
          )
          auditBySeq.set(seq, {
            ...audit,
            finalized: true,
            stage: BOT_LISTING_STAGE.SAVED,
            outcome: BOT_LISTING_OUTCOME.ACCEPTED,
            evaluated: true,
            score,
            shouldApply: true,
            flags,
            reasoning,
            resumeMatch,
            scoringInputs,
            decisionReason: `Saved — score ${score} meets or exceeds minimum (${botConfig.minScore}).`,
          })
        } else if (!evaluated && !openAi) {
          pushLog(
            'info',
            `Saved (no AI): ${job.title} @ ${job.company} — OPENAI_API_KEY unset`
          )
          auditBySeq.set(seq, {
            ...audit,
            finalized: true,
            stage: BOT_LISTING_STAGE.SAVED_NO_AI,
            outcome: BOT_LISTING_OUTCOME.ACCEPTED,
            evaluated: false,
            score: null,
            shouldApply: null,
            flags: [],
            reasoning: null,
            resumeMatch: null,
            scoringInputs,
            decisionReason:
              'Saved without AI scoring because OPENAI_API_KEY is not configured on the server.',
          })
        }
      } catch (saveErr) {
        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr)
        pushLog('error', `Failed to save "${job.title}": ${msg}`)
        result.jobsSaveFailed++
        result.errors[`save_${job.title.slice(0, 30)}`] = msg
        result.fatalError ??= 'One or more matched listings could not be saved to your tracker.'
        const prev = auditBySeq.get(seq)!
        auditBySeq.set(seq, {
          ...prev,
          finalized: true,
          stage: BOT_LISTING_STAGE.SAVE_FAILED,
          outcome: BOT_LISTING_OUTCOME.REJECTED,
          errorMessage: msg.slice(0, 4000),
          decisionReason: `Database save failed: ${msg.slice(0, 500)}`,
        })
      }
    }

    if (openAi) {
      pushLog(
        'info',
        `Running AI evaluation with concurrency=${Math.min(aiEvalConcurrency, jobsToProcess.length || 1)} for ${jobsToProcess.length} listing(s)`
      )
      await runLimited(jobsToProcess, aiEvalConcurrency, processJob)
    } else {
      for (const item of jobsToProcess) {
        await processJob(item)
      }
    }

    pushLog(
      'info',
      `Pipeline done: found=${result.jobsFound} saved=${result.jobsNew} ` +
        `approved=${result.jobsApproved} below_AI_threshold=${result.jobsSkippedLowScore} ` +
        `hard_filter=${result.jobsHardFiltered} ` +
        `eval_failed=${result.jobsEvaluationFailed} ` +
        `save_failed=${result.jobsSaveFailed} ` +
        `dedup_url=${result.skippedExistingByUrl} dedup_title=${result.skippedExistingByTitle} dedup_batch=${result.skippedBatchDuplicate} dedup_dismissed=${result.skippedPreviouslyDismissed}`
    )

    auditFinished = true
    return result
  } finally {
    await persistLogs()
    await persistListingAudit()
  }
}

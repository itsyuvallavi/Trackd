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
import { preFilterJob } from './pre-filter'
import { runSearch } from './adapters/search-client'
import { botSearchHasQueryableBackend } from './bot-search-sources'
import { buildBotSearchRequest } from './search-request'
import {
  BOT_SEARCH_AI_EVAL_CONCURRENCY,
  BOT_SEARCH_AI_EVAL_MAX_PER_RUN,
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

function skippedScoringNote(stage: string): Prisma.InputJsonValue {
  return {
    note: 'AI evaluator was not run for this listing.',
    filterStage: stage,
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

function noOpenAiSnapshot(): Prisma.InputJsonValue {
  return {
    note: 'OPENAI_API_KEY was not set — listing saved without AI scoring.',
    gateway: 'none',
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

    const searchRequest = buildBotSearchRequest(botConfig)

    pushLog('info', 'Search request built from /settings/bot', {
      keywords: searchRequest.keywords,
      locations: searchRequest.locations,
      remote_only: searchRequest.remote_only,
      experience_level: searchRequest.experience_level ?? null,
      exclude_companies_count: searchRequest.exclude_companies?.length ?? 0,
      exclude_keywords_count: searchRequest.exclude_keywords?.length ?? 0,
      spoken_languages: botConfig.spokenLanguages ?? [],
      min_score: botConfig.minScore,
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
            scoringInputs: skippedScoringNote(BOT_LISTING_STAGE.DEDUP_DISMISSED),
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
          scoringInputs: skippedScoringNote(BOT_LISTING_STAGE.DEDUP_DISMISSED),
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
          scoringInputs: skippedScoringNote(BOT_LISTING_STAGE.DEDUP_URL),
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
          scoringInputs: skippedScoringNote(BOT_LISTING_STAGE.DEDUP_TITLE),
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
          scoringInputs: skippedScoringNote(BOT_LISTING_STAGE.DEDUP_BATCH),
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
    const jobsWithAudit: Array<{ job: SearchJobResult; seq: number; audit: MutableListing }> = []
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

    const aiEvalMax = BOT_SEARCH_AI_EVAL_MAX_PER_RUN
    const aiEvalConcurrency = BOT_SEARCH_AI_EVAL_CONCURRENCY
    const jobsToProcess = openAi ? jobsWithAudit.slice(0, aiEvalMax) : jobsWithAudit
    const budgetedJobs = openAi ? jobsWithAudit.slice(aiEvalMax) : []

    if (openAi && budgetedJobs.length > 0) {
      const message =
        `AI evaluation budget reached: evaluating ${jobsToProcess.length}/${jobsWithAudit.length} ` +
        `new listing(s); ${budgetedJobs.length} left unscored and not saved.`
      result.errors['evaluation_budget'] = message
      pushLog('warn', message, {
        maxEvaluations: aiEvalMax,
        concurrency: aiEvalConcurrency,
        skipped: budgetedJobs.length,
      })
      for (const { job, seq, audit } of budgetedJobs) {
        result.jobsSkippedLowScore++
        result.evaluationSkips.push({
          title: job.title.slice(0, 200),
          company: job.company.slice(0, 120),
          score: 0,
          minScore: botConfig.minScore,
          flags: ['eval_budget'],
          reasoning:
            `Skipped AI scoring because this run reached the production evaluation budget (${aiEvalMax}).`,
          filterKind: 'eval_budget',
          jobBoard: job.jobBoard ?? null,
          providerPass: job.providerPass ?? null,
        })
        auditBySeq.set(seq, {
          ...audit,
          finalized: true,
          stage: BOT_LISTING_STAGE.EVAL_BUDGET,
          outcome: BOT_LISTING_OUTCOME.REJECTED,
          evaluated: false,
          score: null,
          shouldApply: false,
          flags: ['eval_budget'],
          reasoning:
            `Skipped AI scoring because this run reached the production evaluation budget (${aiEvalMax}).`,
          resumeMatch: null,
          scoringInputs: {
            note: 'AI evaluator was not run because the per-run evaluation budget was exhausted.',
            maxEvaluations: aiEvalMax,
            concurrency: aiEvalConcurrency,
          },
          decisionReason:
            'AI evaluation budget was exhausted before this listing was scored — listing not saved.',
        })
        pushLog('info', `Budget skipped (not saved): ${job.title} @ ${job.company}`)
      }
    }

    const processJob = async ({
      job,
      seq,
      audit,
    }: {
      job: SearchJobResult
      seq: number
      audit: MutableListing
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
            scoringInputs = si as unknown as Prisma.InputJsonValue
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
              },
              decisionReason: preFilter.reason,
            })
            return
          }
          scoringInputs = noOpenAiSnapshot()
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
        `Running AI evaluation with concurrency=${Math.min(aiEvalConcurrency, jobsToProcess.length || 1)} max=${aiEvalMax}`
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

'use client'

import Link from 'next/link'
import type { BotRun, BotRunStatus } from '@prisma/client'
import { cn } from '@/lib/utils'
import type { BotRunProfileSourceSummary } from '@/lib/cached-queries'

type BotRunRow = Pick<
  BotRun,
  | 'id'
  | 'status'
  | 'source'
  | 'jobsFound'
  | 'jobsNew'
  | 'jobsApproved'
  | 'startedAt'
  | 'completedAt'
  | 'duration'
  | 'errors'
  | 'searchMeta'
> & {
  profileSources?: BotRunProfileSourceSummary[]
}

interface BotRunsPanelProps {
  runs: BotRunRow[]
}

function pipelineSummaryFromRun(errors: BotRun['errors']): string | null {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors))
    return null
  const p = (errors as Record<string, unknown>).pipeline
  return typeof p === 'string' ? p : null
}

function providerDuplicatesFromRun(errors: BotRun['errors']): string | null {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors))
    return null
  const p = (errors as Record<string, unknown>).providerDuplicates
  return typeof p === 'string' ? p : null
}

type RuntimeTimingSummary = {
  total_ms: number
  bottleneck: {
    phase: string
    duration_ms: number
  } | null
  phases: Record<string, number>
  counts: Record<string, number>
}

function runtimeTimingsFromRun(searchMeta: BotRun['searchMeta']): RuntimeTimingSummary | null {
  if (!searchMeta || typeof searchMeta !== 'object' || Array.isArray(searchMeta)) return null
  const raw = (searchMeta as Record<string, unknown>).runtime_timings
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.total_ms !== 'number') return null

  const phases =
    o.phases && typeof o.phases === 'object' && !Array.isArray(o.phases)
      ? Object.fromEntries(
          Object.entries(o.phases as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number'
          )
        )
      : {}
  const counts =
    o.counts && typeof o.counts === 'object' && !Array.isArray(o.counts)
      ? Object.fromEntries(
          Object.entries(o.counts as Record<string, unknown>).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number'
          )
        )
      : {}

  const rawBottleneck = o.bottleneck
  const bottleneck =
    rawBottleneck && typeof rawBottleneck === 'object' && !Array.isArray(rawBottleneck)
      ? (rawBottleneck as Record<string, unknown>)
      : null

  return {
    total_ms: o.total_ms,
    bottleneck:
      typeof bottleneck?.phase === 'string' && typeof bottleneck.duration_ms === 'number'
        ? { phase: bottleneck.phase, duration_ms: bottleneck.duration_ms }
        : null,
    phases,
    counts,
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    profile_load: 'Profile',
    search_profile_build: 'Search profile',
    search_request_build: 'Query plan',
    provider_search: 'Provider search',
    dedupe_db_lookup: 'DB dedupe',
    dedupe_filter: 'Dedupe',
    pre_filter: 'Pre-filter',
    priority_sort: 'Ranking',
    ai_scoring: 'AI scoring',
    job_persistence: 'Saving jobs',
    listing_audit_persistence: 'Audit save',
  }
  return labels[phase] ?? phase.replaceAll('_', ' ')
}

function RuntimeTimings({ timings }: { timings: RuntimeTimingSummary }) {
  const topPhases = Object.entries(timings.phases)
    .filter(([, duration]) => duration > 0)
    .slice(0, 4)

  return (
    <details className="text-xs group">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
        Runtime {formatMs(timings.total_ms)}
        {timings.bottleneck
          ? ` · slowest ${phaseLabel(timings.bottleneck.phase)} ${formatMs(timings.bottleneck.duration_ms)}`
          : ''}
      </summary>
      <div className="mt-2 grid gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground sm:grid-cols-2">
        {topPhases.map(([phase, duration]) => (
          <div key={phase} className="flex items-center justify-between gap-3">
            <span>{phaseLabel(phase)}</span>
            <span className="tabular-nums text-foreground/80">{formatMs(duration)}</span>
          </div>
        ))}
        {typeof timings.counts.ai_scored === 'number' && (
          <div className="flex items-center justify-between gap-3">
            <span>AI scored</span>
            <span className="tabular-nums text-foreground/80">{timings.counts.ai_scored}</span>
          </div>
        )}
        {typeof timings.counts.jobs_saved === 'number' && (
          <div className="flex items-center justify-between gap-3">
            <span>Saved</span>
            <span className="tabular-nums text-foreground/80">{timings.counts.jobs_saved}</span>
          </div>
        )}
      </div>
    </details>
  )
}

type EvaluationSkipRow = {
  title: string
  company: string
  score: number
  minScore: number
  flags: string[]
  reasoning: string
  filterKind: 'hard_filter' | 'ai_score' | 'eval_budget'
  priorityScore: number | null
  priorityReasons: string[]
  jobBoard: string | null
  providerPass: {
    providerQuery?: string
    location?: string
    siteNames?: string[]
  } | null
}

type EvaluationFailureRow = {
  title: string
  company: string
  error: string
}

function evaluationSkipsFromRun(
  errors: BotRun['errors']
): EvaluationSkipRow[] {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return []
  const raw = (errors as Record<string, unknown>).evaluationSkips
  if (!Array.isArray(raw)) return []
  const out: EvaluationSkipRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    if (typeof o.title !== 'string' || typeof o.company !== 'string') continue
    if (typeof o.score !== 'number' || typeof o.minScore !== 'number') continue
    const reasoning = typeof o.reasoning === 'string' ? o.reasoning : ''
    const flags = Array.isArray(o.flags)
      ? o.flags.filter((f): f is string => typeof f === 'string')
      : []
    const rawKind = typeof o.filterKind === 'string' ? o.filterKind : null
    const isBudgetSkip = rawKind === 'eval_budget' || flags.includes('eval_budget')
    const inferredHardFilter =
      rawKind === 'hard_filter' ||
      (!rawKind &&
        o.score <= 30 &&
        flags.some((f) => ['wrong_location', 'underqualified', 'overqualified'].includes(f)))
    const providerPass =
      o.providerPass && typeof o.providerPass === 'object' && !Array.isArray(o.providerPass)
        ? (o.providerPass as EvaluationSkipRow['providerPass'])
        : null
    out.push({
      title: o.title,
      company: o.company,
      score: o.score,
      minScore: o.minScore,
      flags,
      reasoning,
      filterKind: isBudgetSkip ? 'eval_budget' : inferredHardFilter ? 'hard_filter' : 'ai_score',
      priorityScore: typeof o.priorityScore === 'number' ? o.priorityScore : null,
      priorityReasons: Array.isArray(o.priorityReasons)
        ? o.priorityReasons.filter((f): f is string => typeof f === 'string')
        : [],
      jobBoard: typeof o.jobBoard === 'string' ? o.jobBoard : null,
      providerPass,
    })
  }
  return out
}

function evaluationFailuresFromRun(
  errors: BotRun['errors']
): EvaluationFailureRow[] {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return []
  const raw = (errors as Record<string, unknown>).evaluationFailures
  if (!Array.isArray(raw)) return []
  const out: EvaluationFailureRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    if (typeof o.title !== 'string' || typeof o.company !== 'string') continue
    const error = typeof o.error === 'string' ? o.error : ''
    out.push({
      title: o.title,
      company: o.company,
      error,
    })
  }
  return out
}

function historicalBudgetNoteFromRun(errors: BotRun['errors']): string | null {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return null
  const budget = (errors as Record<string, unknown>).evaluation_budget
  return typeof budget === 'string' ? budget : null
}

function displayFlags(flags: string[]): string[] {
  return flags.filter((flag) => flag !== 'eval_budget')
}

function profileSourceBadgeClass(source: BotRunProfileSourceSummary): string {
  switch (source.kind) {
    case 'parsed_resume':
      return 'border-success/25 bg-success-bg text-success-text'
    case 'none':
      return 'border-error/25 bg-error-bg/50 text-error-text'
    case 'raw_resume_fallback':
    case 'application_identity_fallback':
    case 'settings_fallback':
      return 'border-warning/25 bg-warning-bg text-warning-text'
  }
}

function isLimitedProfileSource(source: BotRunProfileSourceSummary): boolean {
  return source.kind !== 'parsed_resume'
}

function profileSourceDetail(source: BotRunProfileSourceSummary): string | null {
  if (source.limitations.length > 0) return source.limitations[0]
  if (source.applicationIdentitySupplemented) return 'Application Identity supplemented scoring context.'
  if (source.settingsDerivedSignalsUsed) return 'Settings-derived signals were used as fallback context.'
  return null
}

function ProfileSourceSummary({
  sources,
}: {
  sources: BotRunProfileSourceSummary[]
}) {
  if (sources.length === 0) return null

  const limited = sources.some(isLimitedProfileSource)

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/80">Scoring profile</span>
      {sources.map((source) => {
        const detail = profileSourceDetail(source)
        return (
          <span
            key={`${source.kind}-${source.label}-${source.resumeLabel ?? 'none'}`}
            className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5"
          >
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 font-medium',
                profileSourceBadgeClass(source)
              )}
              title={detail ?? undefined}
            >
              {source.label}
              {source.resumeLabel ? ` · ${source.resumeLabel}` : ''}
              {source.listings > 1 ? ` · ${source.listings} listings` : ''}
            </span>
            {detail && <span>{detail}</span>}
          </span>
        )
      })}
      {limited && (
        <Link
          href="/bot/resumes"
          className="font-medium underline underline-offset-2 hover:text-foreground"
        >
          Review resumes
        </Link>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: BotRunStatus }) {
  const styles: Record<BotRunStatus, string> = {
    RUNNING:
      'bg-info-bg text-info-text border-info/25',
    COMPLETED:
      'bg-success-bg text-success-text border-success/25',
    FAILED: 'bg-error-bg text-error-text border-error/25',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border',
        styles[status]
      )}
    >
      {status.toLowerCase()}
    </span>
  )
}

function LocalDateTime({ iso }: { iso: string | Date }) {
  return (
    <span suppressHydrationWarning>
      {new Date(iso).toLocaleString()}
    </span>
  )
}

export function BotRunsPanel({ runs }: BotRunsPanelProps) {
  if (runs.length === 0) {
    return (
      <div className="glass glass-subtle rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">
        No runs yet. Use <strong>Run now</strong> or wait for the next
        scheduled search.
      </div>
    )
  }

  return (
    <div className="glass glass-subtle rounded-2xl overflow-hidden">
      <div className="divide-y divide-border/60">
        {runs.map((run) => {
          const pipeline = pipelineSummaryFromRun(run.errors)
          const providerDuplicates = providerDuplicatesFromRun(run.errors)
          const evalSkips = evaluationSkipsFromRun(run.errors)
          const hardFilterSkips = evalSkips.filter((s) => s.filterKind === 'hard_filter')
          const budgetSkips = evalSkips.filter((s) => s.filterKind === 'eval_budget')
          const aiScoreSkips = evalSkips.filter((s) => s.filterKind === 'ai_score')
          const evalFailures = evaluationFailuresFromRun(run.errors)
          const historicalBudgetNote = historicalBudgetNoteFromRun(run.errors)
          const profileSources = run.profileSources ?? []
          const runtimeTimings = runtimeTimingsFromRun(run.searchMeta)
          return (
            <div key={run.id} className="px-5 py-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={run.status} />
                <span className="text-muted-foreground text-xs flex-1 min-w-[10rem]">
                  <LocalDateTime iso={run.startedAt} />
                  {run.source === 'manual' && ' · manual'}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {run.jobsFound} from API · {run.jobsNew} saved ·{' '}
                  {run.jobsApproved} approved
                </span>
                {run.duration != null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {(run.duration / 1000).toFixed(0)}s
                  </span>
                )}
              </div>
              <ProfileSourceSummary sources={profileSources} />
              {pipeline && (
                <p
                  className="text-[10px] font-mono text-muted-foreground leading-snug break-all"
                  title="Provider duplicates, dedup vs your DB, AI threshold skips, and saves"
                >
                  {pipeline}
                </p>
              )}
              {providerDuplicates && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {providerDuplicates}
                </p>
              )}
              {runtimeTimings && <RuntimeTimings timings={runtimeTimings} />}
              {hardFilterSkips.length > 0 && (
                <details className="text-xs group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                    Filtered {hardFilterSkips.length} before AI scoring — show
                    reasons
                  </summary>
                  <ul className="mt-2 space-y-3 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
                    {hardFilterSkips.map((s, i) => (
                      <li key={`${run.id}-hard-filter-${i}`}>
                        <p className="font-medium text-foreground leading-tight">
                          {s.title}{' '}
                          <span className="text-muted-foreground font-normal">
                            @ {s.company}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                          Filtered before scoring · Score {s.score}/{s.minScore}
                          {s.flags.length > 0 ? ` · ${s.flags.join(', ')}` : ''}
                        </p>
                        {(s.jobBoard || s.providerPass?.providerQuery) && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {s.jobBoard ? `Board ${s.jobBoard}` : 'Provider pass'}
                            {s.providerPass?.providerQuery ? ` · "${s.providerPass.providerQuery}"` : ''}
                            {s.providerPass?.location ? ` · ${s.providerPass.location}` : ''}
                          </p>
                        )}
                        <p className="text-[11px] leading-snug text-foreground/90 mt-1">
                          {s.reasoning}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {budgetSkips.length > 0 && (
                <details className="text-xs group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                    Historical scoring cap skipped {budgetSkips.length} in this old run —
                    show details
                  </summary>
                  <p className="mt-2 rounded-md border border-warning/25 bg-warning-bg px-3 py-2 text-[11px] leading-snug text-warning-text">
                    These listings are preserved audit data from an older scorer version.
                    Current Job Search runs no longer use the 12-listing AI evaluation cap;
                    every eligible listing returned by search is sent through scoring.
                    {historicalBudgetNote ? ` Previous run note: ${historicalBudgetNote}` : ''}
                  </p>
                  <ul className="mt-2 space-y-3 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
                    {budgetSkips.map((s, i) => {
                      const flags = displayFlags(s.flags)
                      return (
                        <li key={`${run.id}-budget-skip-${i}`}>
                          <p className="font-medium text-foreground leading-tight">
                            {s.title}{' '}
                            <span className="text-muted-foreground font-normal">
                              @ {s.company}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            Legacy cap skip
                            {s.priorityScore != null ? ` · Rank ${s.priorityScore}` : ''}
                            {flags.length > 0 ? ` · ${flags.join(', ')}` : ''}
                          </p>
                          {s.priorityReasons.length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Signals: {s.priorityReasons.join(', ')}
                            </p>
                          )}
                          {(s.jobBoard || s.providerPass?.providerQuery) && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {s.jobBoard ? `Board ${s.jobBoard}` : 'Provider pass'}
                              {s.providerPass?.providerQuery ? ` · "${s.providerPass.providerQuery}"` : ''}
                              {s.providerPass?.location ? ` · ${s.providerPass.location}` : ''}
                            </p>
                          )}
                          <p className="text-[11px] leading-snug text-foreground/90 mt-1">
                            {s.reasoning}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )}
              {aiScoreSkips.length > 0 && (
                <details className="text-xs group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                    AI scored {aiScoreSkips.length} below your min score — show
                    model reasoning
                  </summary>
                  <ul className="mt-2 space-y-3 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
                    {aiScoreSkips.map((s, i) => (
                      <li key={`${run.id}-eval-skip-${i}`}>
                        <p className="font-medium text-foreground leading-tight">
                          {s.title}{' '}
                          <span className="text-muted-foreground font-normal">
                            @ {s.company}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                          Score {s.score}/{s.minScore}
                          {s.flags.length > 0 ? ` · ${s.flags.join(', ')}` : ''}
                        </p>
                        {(s.jobBoard || s.providerPass?.providerQuery) && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {s.jobBoard ? `Board ${s.jobBoard}` : 'Provider pass'}
                            {s.providerPass?.providerQuery ? ` · "${s.providerPass.providerQuery}"` : ''}
                            {s.providerPass?.location ? ` · ${s.providerPass.location}` : ''}
                          </p>
                        )}
                        <p className="text-[11px] leading-snug text-foreground/90 mt-1">
                          {s.reasoning}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {evalFailures.length > 0 && (
                <details className="text-xs group">
                  <summary className="cursor-pointer text-error-text hover:text-foreground select-none">
                    AI scoring failed for {evalFailures.length} listing
                    {evalFailures.length === 1 ? '' : 's'} — show errors
                  </summary>
                  <ul className="mt-2 space-y-3 border-l-2 border-error/30 pl-3 max-h-64 overflow-y-auto">
                    {evalFailures.map((f, i) => (
                      <li key={`${run.id}-eval-failure-${i}`}>
                        <p className="font-medium text-foreground leading-tight">
                          {f.title}{' '}
                          <span className="text-muted-foreground font-normal">
                            @ {f.company}
                          </span>
                        </p>
                        <p className="text-[11px] leading-snug text-error-text mt-1">
                          {f.error}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

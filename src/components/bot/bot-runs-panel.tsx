'use client'

import type { BotRun, BotRunStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

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
>

interface BotRunsPanelProps {
  runs: BotRunRow[]
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
    provider_search: 'Searching',
    dedupe_db_lookup: 'Existing jobs check',
    dedupe_filter: 'Duplicate cleanup',
    pre_filter: 'Eligibility check',
    priority_sort: 'Ranking',
    ai_scoring: 'AI scoring',
    job_persistence: 'Saving jobs',
    listing_audit_persistence: 'Saving results',
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
}

type EvaluationFailureRow = {
  title: string
  company: string
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
    out.push({
      title: o.title,
      company: o.company,
    })
  }
  return out
}

function displayFlags(flags: string[]): string[] {
  return flags.filter((flag) => flag !== 'eval_budget')
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

function ActivitySummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="glass glass-subtle rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function RunMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function RunSignal({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'error' | 'muted'
  children: React.ReactNode
}) {
  const styles = {
    success: 'border-success/25 bg-success-bg text-success-text',
    warning: 'border-warning/25 bg-warning-bg text-warning-text',
    error: 'border-error/25 bg-error-bg/50 text-error-text',
    muted: 'border-border bg-muted/30 text-muted-foreground',
  } satisfies Record<typeof tone, string>

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        styles[tone]
      )}
    >
      {children}
    </span>
  )
}

function DiagnosticGroup({
  title,
  rows,
  emptyText,
  kind,
}: {
  title: string
  rows: EvaluationSkipRow[]
  emptyText: string
  kind: EvaluationSkipRow['filterKind']
}) {
  if (rows.length === 0) {
    return emptyText ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : null
  }

  return (
    <details className="group/diagnostic">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
        {title}
      </summary>
      <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
        {rows.map((row, index) => {
          const flags = kind === 'eval_budget' ? displayFlags(row.flags) : row.flags
          return (
            <li
              key={`${kind}-${index}-${row.title}-${row.company}`}
              className="rounded-lg border border-border/60 bg-background/40 px-3 py-2"
            >
              <p className="text-sm font-medium leading-tight text-foreground">
                {row.title}{' '}
                <span className="font-normal text-muted-foreground">
                  @ {row.company}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {kind === 'eval_budget'
                  ? 'Legacy cap skip'
                  : kind === 'hard_filter'
                    ? 'Filtered before scoring'
                    : `Score ${row.score}/${row.minScore}`}
                {flags.length > 0 ? ` · ${flags.join(', ')}` : ''}
              </p>
              {row.reasoning && (
                <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                  {row.reasoning}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function RunDetailsOverview({
  filteredCount,
  belowScoreCount,
  legacySkipCount,
  failureCount,
}: {
  filteredCount: number
  belowScoreCount: number
  legacySkipCount: number
  failureCount: number
}) {
  const rows = [
    { label: 'Filtered before scoring', value: filteredCount },
    { label: 'Below minimum score', value: belowScoreCount },
    { label: 'Needs review', value: legacySkipCount + failureCount },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {row.label}
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {row.value}
          </p>
        </div>
      ))}
    </div>
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
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <ActivitySummaryCard
          label="Recent runs"
          value={runs.length}
          hint="Latest 25 searches"
        />
        <ActivitySummaryCard
          label="Jobs found"
          value={runs.reduce((sum, run) => sum + run.jobsFound, 0)}
          hint="Across visible runs"
        />
        <ActivitySummaryCard
          label="Saved"
          value={runs.reduce((sum, run) => sum + run.jobsNew, 0)}
          hint="Added to your queue"
        />
      </div>

      <div className="space-y-3">
        {runs.map((run) => {
          const evalSkips = evaluationSkipsFromRun(run.errors)
          const hardFilterSkips = evalSkips.filter((s) => s.filterKind === 'hard_filter')
          const budgetSkips = evalSkips.filter((s) => s.filterKind === 'eval_budget')
          const aiScoreSkips = evalSkips.filter((s) => s.filterKind === 'ai_score')
          const evalFailures = evaluationFailuresFromRun(run.errors)
          const runtimeTimings = runtimeTimingsFromRun(run.searchMeta)
          const totalRejected = hardFilterSkips.length + aiScoreSkips.length
          const issueCount = budgetSkips.length + evalFailures.length
          const scoredCount =
            typeof runtimeTimings?.counts.ai_scored === 'number'
              ? runtimeTimings.counts.ai_scored
              : null

          return (
            <article
              key={run.id}
              className="glass glass-subtle rounded-2xl px-4 py-4 md:px-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={run.status} />
                    <span className="text-sm font-medium text-foreground">
                      <LocalDateTime iso={run.startedAt} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {run.source === 'manual' ? 'Manual' : 'Scheduled'}
                    </span>
                    {run.duration != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatMs(run.duration)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <RunMetric label="Found" value={run.jobsFound} />
                    <RunMetric label="Scored" value={scoredCount ?? '—'} />
                    <RunMetric label="Saved" value={run.jobsNew} />
                    <RunMetric label="Approved" value={run.jobsApproved} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  {totalRejected > 0 && (
                    <RunSignal tone="muted">
                      {totalRejected} rejected
                    </RunSignal>
                  )}
                  {hardFilterSkips.length > 0 && (
                    <RunSignal tone="warning">
                      {hardFilterSkips.length} filtered
                    </RunSignal>
                  )}
                  {issueCount > 0 && (
                    <RunSignal tone="error">
                      {issueCount} needs review
                    </RunSignal>
                  )}
                  {issueCount === 0 && run.status === 'COMPLETED' && (
                    <RunSignal tone="success">Clean run</RunSignal>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <details className="group rounded-xl border border-border/60 bg-background/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    <span>Run details</span>
                    <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                      Show diagnostics
                    </span>
                    <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
                      Hide diagnostics
                    </span>
                  </summary>

                  <div className="space-y-4 border-t border-border/60 px-3 py-3">
                    <RunDetailsOverview
                      filteredCount={hardFilterSkips.length}
                      belowScoreCount={aiScoreSkips.length}
                      legacySkipCount={budgetSkips.length}
                      failureCount={evalFailures.length}
                    />

                    {runtimeTimings && <RuntimeTimings timings={runtimeTimings} />}

                    <DiagnosticGroup
                      title={`Filtered before scoring (${hardFilterSkips.length})`}
                      rows={hardFilterSkips}
                      emptyText="No deterministic filters triggered."
                      kind="hard_filter"
                    />

                    <DiagnosticGroup
                      title={`Below minimum score (${aiScoreSkips.length})`}
                      rows={aiScoreSkips}
                      emptyText="No AI-scored listings were below threshold."
                      kind="ai_score"
                    />

                    {budgetSkips.length > 0 && (
                      <div className="space-y-2">
                        <p className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning-text">
                          Legacy audit data: these listings were skipped by an older scoring cap.
                          Current runs score every eligible listing.
                        </p>
                        <DiagnosticGroup
                          title={`Legacy cap skips (${budgetSkips.length})`}
                          rows={budgetSkips}
                          emptyText=""
                          kind="eval_budget"
                        />
                      </div>
                    )}

                    {evalFailures.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-error-text">
                          Scoring failures ({evalFailures.length})
                        </p>
                        <ul className="space-y-2">
                          {evalFailures.map((failure, index) => (
                            <li
                              key={`${run.id}-eval-failure-${index}`}
                              className="rounded-lg border border-error/20 bg-error-bg/30 px-3 py-2"
                            >
                              <p className="text-sm font-medium leading-tight text-foreground">
                                {failure.title}{' '}
                                <span className="font-normal text-muted-foreground">
                                  @ {failure.company}
                                </span>
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-error-text">
                                Scoring could not complete for this listing. Technical details are hidden from the activity page.
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

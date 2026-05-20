'use client'

import { useEffect, useState } from 'react'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <span suppressHydrationWarning>
      {mounted ? new Date(iso).toLocaleString() : 'Recent run'}
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
          const evalSkips = evaluationSkipsFromRun(run.errors)
          const hardFilterSkips = evalSkips.filter((s) => s.filterKind === 'hard_filter')
          const budgetSkips = evalSkips.filter((s) => s.filterKind === 'eval_budget')
          const aiScoreSkips = evalSkips.filter((s) => s.filterKind === 'ai_score')
          const evalFailures = evaluationFailuresFromRun(run.errors)
          const profileSources = run.profileSources ?? []
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
                  title="Dedup vs your DB, AI threshold skips, and saves"
                >
                  {pipeline}
                </p>
              )}
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
                    Budget skipped {budgetSkips.length} after deterministic ranking — show
                    signals
                  </summary>
                  <ul className="mt-2 space-y-3 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
                    {budgetSkips.map((s, i) => (
                      <li key={`${run.id}-budget-skip-${i}`}>
                        <p className="font-medium text-foreground leading-tight">
                          {s.title}{' '}
                          <span className="text-muted-foreground font-normal">
                            @ {s.company}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                          Not AI scored
                          {s.priorityScore != null ? ` · Rank ${s.priorityScore}` : ''}
                          {s.flags.length > 0 ? ` · ${s.flags.join(', ')}` : ''}
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
                    ))}
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

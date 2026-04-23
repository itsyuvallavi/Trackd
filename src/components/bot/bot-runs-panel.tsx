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
>

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
    out.push({
      title: o.title,
      company: o.company,
      score: o.score,
      minScore: o.minScore,
      flags,
      reasoning,
    })
  }
  return out
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
          return (
            <div key={run.id} className="px-5 py-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={run.status} />
                <span className="text-muted-foreground text-xs flex-1 min-w-[10rem]">
                  {new Date(run.startedAt).toLocaleString()}
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
              {pipeline && (
                <p
                  className="text-[10px] font-mono text-muted-foreground leading-snug break-all"
                  title="Dedup vs your DB, AI threshold skips, and saves"
                >
                  {pipeline}
                </p>
              )}
              {evalSkips.length > 0 && (
                <details className="text-xs group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                    AI skipped {evalSkips.length} below your min score — show
                    model reasoning
                  </summary>
                  <ul className="mt-2 space-y-3 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
                    {evalSkips.map((s, i) => (
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
                        <p className="text-[11px] leading-snug text-foreground/90 mt-1">
                          {s.reasoning}
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

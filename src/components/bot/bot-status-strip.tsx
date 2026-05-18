'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Play, X, AlertCircle } from 'lucide-react'
import { triggerBotSearch } from '@/app/(authenticated)/settings/bot-actions'
import {
  BOT_RUN_COMPLETE_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
} from '@/lib/constants'

interface BotStatusStripProps {
  isActive: boolean
  frequencyLabel: string
  lastRun: {
    startedAt: string
    jobsFound: number
    jobsNew: number
    jobsApproved: number
  } | null
  canRun: boolean
  runDisabledReason?: string
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function BotStatusStrip({
  isActive,
  frequencyLabel,
  lastRun,
  canRun,
  runDisabledReason,
}: BotStatusStripProps) {
  const router = useRouter()
  const [running, startRun] = useTransition()
  const [toast, setToast] = useState<
    | { kind: 'running' }
    | { kind: 'done'; ok: boolean; msg: string }
    | null
  >(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (toast?.kind !== 'done') return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  function completionMessage(res: {
    jobsFound?: number
    jobsNew?: number
    jobsApproved?: number
    jobsHardFiltered?: number
    jobsSkippedLowScore?: number
    jobsEvaluationFailed?: number
  }) {
    const found = res.jobsFound ?? 0
    const saved = res.jobsNew ?? 0
    const approved = res.jobsApproved ?? 0
    const hardFiltered = res.jobsHardFiltered ?? 0
    const belowScore = res.jobsSkippedLowScore ?? 0
    const evalFailed = res.jobsEvaluationFailed ?? 0

    if (evalFailed > 0 && saved === 0) {
      return `Search found ${found} listing${found === 1 ? '' : 's'}, but AI scoring failed. Open Runs for details.`
    }

    if (saved === 0) {
      if (belowScore > 0) {
        const aiLowScore = Math.max(0, belowScore - hardFiltered)
        if (hardFiltered > 0 && aiLowScore === 0) {
          return `Search found ${found} listing${found === 1 ? '' : 's'}, but all matches were filtered by location or seniority. Open Runs for details.`
        }
        return `Search found ${found} listing${found === 1 ? '' : 's'}, but none met your match threshold. Open Runs for reasoning.`
      }
      return `Search finished: ${found} listing${found === 1 ? '' : 's'} found, 0 saved. Open Runs for details.`
    }

    return `Search saved ${saved} new job${saved === 1 ? '' : 's'}${approved > 0 ? `, ${approved} approved` : ''}.`
  }

  function handleRun() {
    setToast({ kind: 'running' })
    startRun(async () => {
      const res = await triggerBotSearch()
      if (res.success) {
        window.dispatchEvent(new CustomEvent(BOT_RUN_COMPLETE_EVENT))
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
        router.refresh()
        setToast({
          kind: 'done',
          ok: true,
          msg: completionMessage(res),
        })
        return
      }
      if ('runId' in res && res.runId) {
        window.dispatchEvent(new CustomEvent(BOT_RUN_COMPLETE_EVENT))
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
        router.refresh()
      }
      setToast({
        kind: 'done',
        ok: false,
        msg:
          'jobsEvaluationFailed' in res && (res.jobsEvaluationFailed ?? 0) > 0
            ? completionMessage(res)
            : 'error' in res && res.error
              ? res.error
              : 'Search failed.',
      })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'relative inline-flex size-2 rounded-full',
            isActive ? 'bg-success' : 'bg-muted-foreground/50'
          )}
        >
          {isActive && (
            <span className="absolute inset-0 rounded-full bg-success/50 trackd-breath" />
          )}
        </span>
        <span className="font-medium">
          {isActive ? 'Active' : 'Paused'}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{frequencyLabel}</span>
      </span>

      {lastRun && (
        <>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">
            Last run{' '}
            <span className="text-foreground" suppressHydrationWarning>
              {mounted ? relativeTime(lastRun.startedAt) : 'recently'}
            </span>
            {' · '}
            <span className="text-foreground tabular-nums">{lastRun.jobsFound}</span> found
            {' · '}
            <span className="text-foreground tabular-nums">{lastRun.jobsNew}</span> new
            {lastRun.jobsApproved > 0 && (
              <>
                {' · '}
                <span className="text-foreground tabular-nums">{lastRun.jobsApproved}</span> approved
              </>
            )}
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={running || !canRun}
          title={!canRun ? runDisabledReason : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium',
            'bg-primary text-primary-foreground transition-[transform,background-color] duration-150',
            'ease-[var(--ease-ios)] hover:bg-primary/90 active:scale-[0.98]',
            'disabled:opacity-50 disabled:hover:bg-primary disabled:active:scale-100'
          )}
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" fill="currentColor" />
          )}
          {running ? 'Running…' : 'Run now'}
        </button>
      </div>

      {mounted && toast && createPortal(
        <SearchToast toast={toast} onDismiss={() => setToast(null)} />,
        document.body
      )}
    </div>
  )
}

function SearchToast({
  toast,
  onDismiss,
}: {
  toast:
    | { kind: 'running' }
    | { kind: 'done'; ok: boolean; msg: string }
  onDismiss: () => void
}) {
  const isRunning = toast.kind === 'running'
  const isError = toast.kind === 'done' && !toast.ok

  return (
    <div
      role="status"
      aria-live="polite"
      className="!fixed top-4 right-4 z-[100] max-w-sm w-[min(100%-2rem,22rem)] pointer-events-auto animate-in slide-in-from-top-2 fade-in duration-200"
    >
      <div
        className={cn(
          'glass glass-subtle rounded-xl shadow-lg',
          'px-4 py-3 flex items-start gap-3'
        )}
      >
        <span
          className={cn(
            'shrink-0 mt-0.5',
            isRunning && 'text-primary',
            !isRunning && !isError && 'text-success',
            isError && 'text-error-text'
          )}
        >
          {isRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isError ? (
            <AlertCircle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isRunning
              ? 'Searching for jobs…'
              : isError
                ? 'Search failed'
                : 'Search complete'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRunning
              ? 'This can take 10–30 seconds.'
              : toast.kind === 'done'
                ? toast.msg
                : ''}
          </p>
        </div>
        {!isRunning && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1 rounded-md hover:bg-foreground/[0.04]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

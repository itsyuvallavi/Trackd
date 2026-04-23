'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, Loader2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SyncResultToastState =
  | null
  | { phase: 'running' }
  | { phase: 'result'; type: 'success' | 'error'; message: string }

interface SyncResultToastProps {
  state: SyncResultToastState
  onClose: () => void
  /** Auto-dismiss the result state after this many ms (not applied while running). */
  resultDuration?: number
}

/**
 * In-progress + result toast for email sync, portaled to `document.body` with
 * `!fixed` so `.glass` on the card never breaks viewport anchoring.
 */
export function SyncResultToast({
  state,
  onClose,
  resultDuration = 8000,
}: SyncResultToastProps) {
  const [mounted, setMounted] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (state?.phase !== 'result') return
    const t = setTimeout(() => onCloseRef.current(), resultDuration)
    return () => clearTimeout(t)
  }, [state, resultDuration])

  if (!mounted || !state) return null

  const isRunning = state.phase === 'running'
  const isResult = state.phase === 'result'
  const isSuccess = isResult && state.type === 'success'

  const getSimpleResultLine = (message: string) => {
    if (!message) return ''
    const lines = message.split('\n')
    const stats = { total: 0, processed: 0, created: 0, updated: 0 }
    for (const line of lines) {
      const totalMatch = line.match(/Fetched (\d+)/)
      const processedMatch = line.match(/Processed (\d+)/)
      const createdMatch = line.match(/Created (\d+)/)
      const updatedMatch = line.match(/Updated (\d+)/)
      if (totalMatch) stats.total = parseInt(totalMatch[1], 10)
      if (processedMatch) stats.processed = parseInt(processedMatch[1], 10)
      if (createdMatch) stats.created = parseInt(createdMatch[1], 10)
      if (updatedMatch) stats.updated = parseInt(updatedMatch[1], 10)
    }
    if (stats.created > 0 || stats.updated > 0) {
      const parts: string[] = []
      if (stats.created > 0) {
        parts.push(
          `${stats.created} new job${stats.created > 1 ? 's' : ''}`
        )
      }
      if (stats.updated > 0) {
        parts.push(`${stats.updated} updated`)
      }
      return parts.join(', ')
    }
    if (stats.processed > 0) {
      return `${stats.processed} job-related email${stats.processed > 1 ? 's' : ''} processed`
    }
    return 'No updates found'
  }

  const body = isRunning ? (
    <>
      <span className="shrink-0 text-primary" aria-hidden>
        <Loader2 className="size-5 animate-spin" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Syncing your mailbox…</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fetching and scanning messages can take 30s–2 minutes.
        </p>
      </div>
    </>
  ) : isResult ? (
    <>
      <div
        className={cn(
          'shrink-0 size-5 rounded-full flex items-center justify-center',
          isSuccess
            ? 'bg-success-bg text-success'
            : 'bg-error-bg text-error'
        )}
      >
        {isSuccess ? (
          <CheckCircle className="size-4" />
        ) : (
          <XCircle className="size-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-sm font-medium">
          {isSuccess ? 'Sync complete' : 'Sync failed'}
          {isSuccess && `: ${getSimpleResultLine(state.message)}`}
        </p>
        {state.type === 'error' && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
            {state.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-foreground/[0.04]"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </>
  ) : null

  return createPortal(
    <div
      className="!fixed top-4 right-4 z-[100] max-w-sm w-[min(100%-2rem,22rem)] pointer-events-auto animate-in slide-in-from-top-2 fade-in duration-200"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex items-start gap-3 shadow-lg',
          isRunning
            ? 'glass glass-subtle rounded-xl px-4 py-3'
            : 'glass glass-strong rounded-2xl p-3'
        )}
      >
        {body}
      </div>
    </div>,
    document.body
  )
}

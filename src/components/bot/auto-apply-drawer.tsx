'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Bot,
  Send,
} from 'lucide-react'
import { ATS_LABELS } from '@/lib/bot/ats-detector'
import type { ATSType } from '@/lib/bot/ats-detector'

interface AutoApplyDrawerProps {
  jobId: string
  jobTitle: string
  jobCompany: string
  jobUrl: string | null
  onClose: () => void
  onApplied: () => void
}

type Phase =
  | 'filling'       // browser is filling the form
  | 'awaiting_review' // form filled, showing screenshots
  | 'submitting'    // bot is clicking Submit
  | 'submitted'     // done
  | 'failed'
  | 'cancelled'

interface ApplyResult {
  attemptId: string
  atsType: string
  screenshotUrls: string[]
  fieldsFilledCount: number
  skippedFields: string[]
  applySummary?: string[]
  success?: boolean
  error?: string
}

function friendlyAutomationFailure(raw: string): { title: string; detail: string } {
  if (raw.includes('Playwright version mismatch') || raw.includes('428 Precondition')) {
    return {
      title: 'Browser automation version mismatch',
      detail:
        'The automation cloud is on Playwright 1.58. This app pins playwright-core to the same version — redeploy after pulling the latest code. If this message persists, ask your host to upgrade Browserless or align versions.',
    }
  }
  const trimmed = raw.trim()
  if (trimmed.length > 900) {
    return { title: 'Automation failed', detail: `${trimmed.slice(0, 900)}…` }
  }
  return { title: 'Automation failed', detail: trimmed || 'An unexpected error occurred.' }
}

/** Avoid "Unexpected end of JSON input" when the server returns 500 HTML or an empty body. */
async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function AutoApplyDrawer({
  jobId,
  jobTitle,
  jobCompany,
  jobUrl,
  onClose,
  onApplied,
}: AutoApplyDrawerProps) {
  const [phase, setPhase] = useState<Phase>('filling')
  const [result, setResult] = useState<ApplyResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  // Start fill on mount
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const start = async () => {
      try {
        const res = await fetch('/api/bot/auto-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        })
        const data = await parseJsonResponse<ApplyResult & { error?: string }>(res)
        if (data === null) {
          setError(
            `Server returned a non-JSON response (${res.status}). Check Vercel function logs for this request.`
          )
          setPhase('failed')
          return
        }
        const automationFailed =
          typeof data.success === 'boolean' && data.success === false
        if (!res.ok || data.error || automationFailed) {
          setError(data.error ?? `Request failed (${res.status})`)
          setPhase('failed')
          return
        }
        setResult(data)
        setPhase('awaiting_review')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed')
        setPhase('failed')
      }
    }

    start()
  }, [jobId])

  const handleConfirm = async () => {
    if (!result?.attemptId) return
    setConfirming(true)
    setPhase('submitting')
    try {
      const res = await fetch(`/api/bot/auto-apply/${result.attemptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      })
      const data = await parseJsonResponse<{ success: boolean; error?: string }>(res)
      if (data === null) {
        throw new Error(
          `Server returned a non-JSON response (${res.status}). Check Vercel function logs.`
        )
      }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Submit failed')
      setPhase('submitted')
      setTimeout(() => onApplied(), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed')
      setPhase('failed')
    } finally {
      setConfirming(false)
    }
  }

  const handleCancel = async () => {
    if (result?.attemptId) {
      setCancelling(true)
      await fetch(`/api/bot/auto-apply/${result.attemptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      }).catch(() => {})
      setCancelling(false)
    }
    onClose()
  }

  const atsLabel = result?.atsType
    ? (ATS_LABELS[result.atsType as ATSType] ?? result.atsType)
    : 'Job Application'

  const automationFailure =
    phase === 'failed' ? friendlyAutomationFailure(error ?? '') : null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={phase === 'filling' || phase === 'submitting' ? undefined : handleCancel}
      />

      {/* Near full-viewport width so tall/wide page previews are usable; min-w-0 keeps flex from clipping */}
      <div className="relative mx-2 w-[min(100%,calc(100vw-1rem))] max-w-[min(1600px,calc(100vw-1rem))] min-w-0 max-h-[95vh] rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-2xl flex flex-col overflow-hidden sm:mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Bot className="size-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Auto Apply — {atsLabel}
              </span>
            </div>
            <h3 className="font-semibold text-base">{jobTitle}</h3>
            <p className="text-sm text-muted-foreground">{jobCompany}</p>
          </div>
          {phase !== 'filling' && phase !== 'submitting' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Body — min-h-0 + overflow-y-auto required for flex child to scroll long content */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5">
          {/* Filling phase */}
          {phase === 'filling' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="relative">
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="size-8 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-background flex items-center justify-center">
                  <Loader2 className="size-4 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <p className="font-medium">Bot is filling out the form…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connecting to the application page and entering your details.
                  This takes 30–60 seconds.
                </p>
              </div>
              <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          {/* Awaiting review */}
          {phase === 'awaiting_review' && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                <CheckCircle className="size-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    Form filled — {result.fieldsFilledCount} fields completed
                  </p>
                  {result.skippedFields.length > 0 && (
                    <p className="text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                      Skipped: {result.skippedFields.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {result.applySummary && result.applySummary.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    What the bot did
                  </p>
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground/90">
                    {result.applySummary.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Page preview (optional)
                </p>
                {result.screenshotUrls.length > 0 ? (
                  <div className="space-y-3 min-w-0">
                    {result.screenshotUrls.map((url, i) => (
                      <div key={i} className="min-w-0 rounded-lg border border-border bg-muted/20">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-border/80 bg-muted/40">
                          <span className="text-xs text-muted-foreground">
                            Scroll vertically in this panel; scroll horizontally below if needed. For 1:1 pixels, open in a new tab.
                          </span>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={`apply-preview-${i + 1}.png`}
                            className="text-xs font-semibold text-primary hover:underline shrink-0 rounded-md border border-primary/30 px-2 py-1 hover:bg-primary/5"
                          >
                            Open full size (new tab)
                          </a>
                        </div>
                        {/* Wide PNGs: min-w-0 + overflow-x-auto prevents right-edge crop inside flex layouts */}
                        <div className="min-w-0 max-w-full overflow-x-auto overflow-y-visible rounded-b-lg bg-muted/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Form page ${i + 1}`}
                            className="block h-auto max-w-none w-auto align-top"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                    Screenshot unavailable
                  </div>
                )}
              </div>

              {jobUrl && (
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Verify on the actual job page
                </a>
              )}
            </div>
          )}

          {/* Submitting */}
          {phase === 'submitting' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <Loader2 className="size-10 text-primary animate-spin" />
              <div>
                <p className="font-medium">Submitting your application…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The bot is clicking Submit. Do not close this window.
                </p>
              </div>
            </div>
          )}

          {/* Submitted */}
          {phase === 'submitted' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="size-8 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-lg">Application submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {jobTitle} at {jobCompany} has been marked as Applied.
                </p>
              </div>
            </div>
          )}

          {/* Failed */}
          {phase === 'failed' && automationFailure && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm min-w-0">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {automationFailure.title}
                  </p>
                  <p className="text-red-600/80 dark:text-red-400/80 mt-0.5 whitespace-pre-wrap break-words">
                    {automationFailure.detail}
                  </p>
                </div>
              </div>
              {jobUrl && (
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
                >
                  <ExternalLink className="size-4" />
                  Apply manually instead
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {phase === 'awaiting_review' && (
          <div className="flex items-center gap-3 p-5 border-t border-border shrink-0">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Confirm & Submit
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors text-muted-foreground disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

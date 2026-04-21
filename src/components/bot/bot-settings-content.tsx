'use client'

import { useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { BotConfig, BotRun, BotRunStatus, BotSearchFrequency } from '@prisma/client'
import { saveBotConfig, triggerBotSearch, verifyTelegram } from '@/app/(authenticated)/settings/bot-actions'
import { buildBotSearchPreview, defaultSearchUiCaps } from '@/lib/bot/search-preview'
import type { BotSearchBackends, BotSearchUiCaps } from '@/lib/bot/search-preview'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'

type BotSearchRunNotice =
  | null
  | { phase: 'running' }
  | { phase: 'done'; ok: boolean; detail?: string }

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

function pipelineSummaryFromRun(errors: BotRun['errors']): string | null {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return null
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

function evaluationSkipsFromRun(errors: BotRun['errors']): EvaluationSkipRow[] {
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
    const flags = Array.isArray(o.flags) ? o.flags.filter((f): f is string => typeof f === 'string') : []
    out.push({ title: o.title, company: o.company, score: o.score, minScore: o.minScore, flags, reasoning })
  }
  return out
}

const FREQUENCY_ORDER = ['DAILY', 'TWICE_DAILY', 'WEEKLY'] as const satisfies readonly BotSearchFrequency[]

interface BotSettingsContentProps {
  initialConfig: BotConfig | null
  recentRuns: BotRunRow[]
  telegramConfigured: boolean
  searchServiceConfigured: boolean
  searchBackends: BotSearchBackends
  /** From RSC parent — keeps SSR markup identical to hydrated client. */
  searchUiCaps?: BotSearchUiCaps | null
}

const FREQUENCY_LABELS: Record<BotSearchFrequency, string> = {
  DAILY: 'Once daily (8AM UTC)',
  TWICE_DAILY: 'Twice daily (8AM + 8PM UTC)',
  WEEKLY: 'Weekly (Mondays 8AM UTC)',
}

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any level' },
  { value: 'internship', label: 'Internship' },
  { value: 'entry_level', label: 'Entry level' },
  { value: 'mid_level', label: 'Mid level' },
  { value: 'senior_level', label: 'Senior level' },
  { value: 'director', label: 'Director' },
]

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string
  placeholder: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')

  function addTags(raw: string) {
    // Split on comma, slash, or Enter to support "React, Frontend / AI Engineer" style input
    const parts = raw.split(/[,\/\n]+/).map((s) => s.trim()).filter(Boolean)
    const toAdd = parts.filter((p) => p && !values.includes(p))
    if (toAdd.length) onChange([...values, ...toAdd])
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTags(input)
          }
        }}
        onBlur={() => { if (input.trim()) addTags(input) }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <p className="text-[11px] text-muted-foreground mt-1">Press Enter or comma to add</p>
    </div>
  )
}

function StatusBadge({ status }: { status: BotRunStatus }) {
  const styles: Record<BotRunStatus, string> = {
    RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', styles[status])}>
      {status.toLowerCase()}
    </span>
  )
}

export function BotSettingsContent({
  initialConfig,
  recentRuns,
  telegramConfigured,
  searchServiceConfigured,
  searchBackends,
  searchUiCaps,
}: BotSettingsContentProps) {
  const caps = searchUiCaps ?? defaultSearchUiCaps()

  const [isPending, startTransition] = useTransition()
  const [isRunning, startRunTransition] = useTransition()
  const [isVerifying, startVerifyTransition] = useTransition()
  const [saveMessage, setSaveMessage] = useState('')
  const [runMessage, setRunMessage] = useState('')
  const [runNotice, setRunNotice] = useState<BotSearchRunNotice>(null)
  const [verifyMessage, setVerifyMessage] = useState('')

  // Form state
  const [keywords, setKeywords] = useState<string[]>(initialConfig?.keywords ?? [])
  const [locations, setLocations] = useState<string[]>(initialConfig?.locations ?? [])
  const [excludeCompanies, setExcludeCompanies] = useState<string[]>(initialConfig?.excludeCompanies ?? [])
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(initialConfig?.excludeKeywords ?? [])
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>(initialConfig?.spokenLanguages ?? [])
  const [remoteOnly, setRemoteOnly] = useState(initialConfig?.remoteOnly ?? false)
  const [experienceLevel, setExperienceLevel] = useState(initialConfig?.experienceLevel ?? '')
  const [salaryMin, setSalaryMin] = useState<string>(initialConfig?.salaryMin?.toString() ?? '')
  const [isActive, setIsActive] = useState(initialConfig?.isActive ?? false)
  const [frequency, setFrequency] = useState<BotSearchFrequency>(
    initialConfig?.searchFrequency ?? 'DAILY'
  )
  const [telegramChatId, setTelegramChatId] = useState(initialConfig?.telegramChatId ?? '')
  const [minScore, setMinScore] = useState(initialConfig?.minScore ?? 60)

  const searchPreview = useMemo(() => {
    const salaryParsed = (() => {
      const s = salaryMin.trim()
      if (!s) return null
      const n = parseInt(s, 10)
      return Number.isFinite(n) ? n : null
    })()
    const experienceLabel =
      EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel)?.label ?? 'Any level'
    return buildBotSearchPreview({
      keywords,
      locations,
      remoteOnly,
      experienceLabel,
      excludeCompanies,
      excludeKeywords,
      salaryMinUsd: salaryParsed,
      minScore,
      backends: searchBackends,
      caps,
    })
  }, [
    keywords,
    locations,
    remoteOnly,
    experienceLevel,
    excludeCompanies,
    excludeKeywords,
    salaryMin,
    minScore,
    searchBackends,
    caps,
  ])

  function handleSave() {
    setSaveMessage('')
    startTransition(async () => {
      const result = await saveBotConfig({
        keywords,
        locations,
        excludeCompanies,
        excludeKeywords,
        spokenLanguages,
        remoteOnly,
        experienceLevel,
        salaryMin: (() => {
          const s = salaryMin.trim()
          if (!s) return null
          const n = parseInt(s, 10)
          return Number.isFinite(n) ? n : null
        })(),
        isActive,
        searchFrequency: frequency,
        telegramChatId,
        minScore,
      })
      setSaveMessage(result.success ? 'Settings saved.' : 'Failed to save.')
      setTimeout(() => setSaveMessage(''), 3000)
    })
  }

  function handleRunNow() {
    setRunMessage('')
    setRunNotice({ phase: 'running' })
    startRunTransition(async () => {
      const result = await triggerBotSearch()
      setRunNotice({
        phase: 'done',
        ok: result.success,
        detail: result.success ? undefined : (result.error ?? 'Search failed.'),
      })
      setRunMessage(
        result.success ? 'Search finished — see Recent runs below.' : (result.error ?? 'Search failed.')
      )
      setTimeout(() => setRunMessage(''), 6000)
      setTimeout(() => {
        setRunNotice((current) => (current?.phase === 'done' ? null : current))
      }, 8000)
    })
  }

  function dismissRunNotice() {
    setRunNotice(null)
  }

  function handleVerifyTelegram() {
    setVerifyMessage('')
    startVerifyTransition(async () => {
      const result = await verifyTelegram(telegramChatId)
      setVerifyMessage(result.success ? '✓ Test message sent!' : (result.error ?? 'Failed.'))
      setTimeout(() => setVerifyMessage(''), 6000)
    })
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring'
  const labelClass = 'block text-sm font-medium mb-1.5'

  const runNoticePortal =
    runNotice &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className={cn(
          'fixed z-[10060] w-[min(calc(100vw-1.5rem),24rem)] rounded-lg border bg-card py-3 pl-4 pr-12 shadow-lg',
          'animate-in slide-in-from-top-2 fade-in duration-300',
          /* Below mobile bell (top-4) + safe area; below desktop top bar (≈64px) */
          'top-[max(4.25rem,calc(env(safe-area-inset-top,0px)+3.75rem))] md:top-[5.5rem]',
          'right-3 md:right-6',
          runNotice.phase === 'done' &&
            runNotice.ok &&
            'border-green-200 dark:border-green-900/60 dark:bg-card',
          runNotice.phase === 'done' &&
            !runNotice.ok &&
            'border-red-200 dark:border-red-900/60 dark:bg-card'
        )}
        role="status"
        aria-live="polite"
        key={runNotice.phase === 'running' ? 'run-notice-running' : `run-notice-done-${runNotice.ok}`}
      >
        <button
          type="button"
          onClick={dismissRunNotice}
          className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3">
          {runNotice.phase === 'running' ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary mt-0.5" aria-hidden />
          ) : runNotice.ok ? (
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5"
              aria-hidden
            />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" aria-hidden />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium leading-snug break-words">
              {runNotice.phase === 'running'
                ? 'Job search started'
                : runNotice.ok
                  ? 'Job search finished'
                  : 'Job search failed'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed break-words">
              {runNotice.phase === 'running'
                ? 'Searching job APIs and scoring listings. Usually a few minutes — this message updates when the run completes.'
                : runNotice.ok
                  ? 'See Recent runs below for counts and details.'
                  : runNotice.detail ?? 'Something went wrong.'}
            </p>
          </div>
        </div>
      </div>,
      document.body
    )

  return (
    <div className="space-y-6">
      {runNoticePortal}

      {/* Status banners */}
      {!searchServiceConfigured && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-300">
          <strong>No search backends available.</strong> Add{' '}
          <code className="font-mono text-xs">JSEARCH_API_KEY</code> and/or Jobs Search API keys (
          <code className="font-mono text-xs">JOBS_SEARCH_API_KEY</code> / shared RapidAPI key). Optional:{' '}
          <code className="font-mono text-xs">BOT_SEARCH_SOURCES=jsearch</code> or{' '}
          <code className="font-mono text-xs">jobs_search_api</code> in{' '}
          <code className="font-mono text-xs">.env.local</code> to limit which provider runs.
        </div>
      )}

      {/* Active toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div>
          <p className="font-medium text-sm">Bot active</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive ? `Runs ${FREQUENCY_LABELS[frequency].toLowerCase()}` : 'Bot is paused'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
            isActive ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
          role="switch"
          aria-checked={isActive}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
              isActive ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Search preferences */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <h2 className="font-medium text-sm">Search preferences</h2>

        <TagInput
          label="Job keywords *"
          placeholder='e.g. "Frontend Engineer" or "React Developer"'
          values={keywords}
          onChange={setKeywords}
        />

        <TagInput
          label="Locations"
          placeholder='e.g. "Lisbon", "Europe", "Remote" — only what you add here is used'
          values={locations}
          onChange={setLocations}
        />
        <p className="text-xs text-muted-foreground -mt-2">
          {`Up to ${caps.locationPassesMax} tags are used as separate searches (no hidden defaults). Prefer regions you can work from (e.g. Europe, Remote); avoid cities that imply hybrid you can't do (e.g. weekly London if you're in Lisbon). Pair with `}
          <strong>Exclude if description contains</strong>
          {' (e.g. '}
          <span className="font-mono">US only</span>
          {') to filter out bad regions.'}
        </p>

        <div className="flex items-center gap-2">
          <input
            id="remoteOnly"
            type="checkbox"
            checked={remoteOnly}
            onChange={(e) => setRemoteOnly(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="remoteOnly" className="text-sm">Remote only</label>
        </div>

        <div>
          <label className={labelClass}>Experience level</label>
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className={inputClass}
          >
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Minimum salary (USD/year)</label>
          <input
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="e.g. 80000"
            min={0}
            step={5000}
            className={inputClass}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <h2 className="font-medium text-sm">Filters</h2>

        <TagInput
          label="Exclude companies"
          placeholder='e.g. "Revature" or "Infosys"'
          values={excludeCompanies}
          onChange={setExcludeCompanies}
        />

        <TagInput
          label="Exclude if description contains"
          placeholder='e.g. "staffing" or "100% commission"'
          values={excludeKeywords}
          onChange={setExcludeKeywords}
        />

        <div>
          <div className="flex items-end justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <TagInput
                label="Languages you speak"
                placeholder='e.g. "english" or "hebrew" — press Enter to add'
                values={spokenLanguages}
                onChange={setSpokenLanguages}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const add = ['english', 'hebrew']
                setSpokenLanguages((prev) => Array.from(new Set([...prev, ...add])))
              }}
              className="shrink-0 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-muted transition-colors"
            >
              + English &amp; Hebrew
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 -mb-1">
            If a job <strong>requires</strong> any other spoken language (e.g. French, German, Portuguese) and
            you don’t list it here, the match score is lowered. Leave empty to turn this off.
          </p>
        </div>

        <div>
          <label className={labelClass}>Minimum AI match score: <strong>{minScore}/100</strong></label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>0 (all)</span>
            <span>50 (moderate)</span>
            <span>100 (perfect)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Only listings scoring at or above this value are saved and appear in the Bot Queue (when
            OpenAI is configured). Lower matches are discarded.
          </p>
        </div>
      </div>

      {/* Schedule */}
      <div className="border border-border rounded-lg p-4">
        <h2 className="font-medium text-sm mb-3">Schedule</h2>
        <div className="space-y-2">
          {FREQUENCY_ORDER.map((f) => (
            <label key={f} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="frequency"
                value={f}
                checked={frequency === f}
                onChange={() => setFrequency(f)}
                className="accent-primary"
              />
              <span className="text-sm">{FREQUENCY_LABELS[f]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Telegram */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">Telegram notifications</h2>
          {!telegramConfigured && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">TELEGRAM_BOT_TOKEN not set</span>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>1. Message <strong>@BotFather</strong> → <code className="font-mono">/newbot</code> → copy the token → add as <code className="font-mono">TELEGRAM_BOT_TOKEN</code> env var</p>
          <p>2. Start your new bot in Telegram → send <code className="font-mono">/start</code></p>
          <p>3. Open <code className="font-mono">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> → find your <code className="font-mono">chat.id</code></p>
          <p>4. Paste the chat ID below and click Verify</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="e.g. 123456789"
            className={cn(inputClass, 'flex-1')}
          />
          <button
            type="button"
            onClick={handleVerifyTelegram}
            disabled={isVerifying || !telegramChatId.trim() || !telegramConfigured}
            className="px-3 py-2 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-40"
          >
            {isVerifying ? 'Sending…' : 'Verify'}
          </button>
        </div>
        {verifyMessage && (
          <p className={cn('text-xs', verifyMessage.startsWith('✓') ? 'text-green-600' : 'text-red-500')}>
            {verifyMessage}
          </p>
        )}
      </div>

      {/* What the bot will query (mirrors search-client / runSearch) */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/25">
        <h2 className="font-medium text-sm">Next search (preview)</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This reflects the form above. <strong>Run now</strong> and the cron job use whatever is{' '}
          <strong>saved</strong> on the server — click <strong>Save settings</strong> after edits so
          they match.
        </p>
        {!searchPreview.hasKeywords ? (
          <p className="text-sm text-muted-foreground">Add at least one keyword to see the query.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Combined query (first {caps.keywordOrMax} keywords, OR)
              </p>
              <p className="font-mono text-xs mt-1 break-all bg-background/80 border border-border rounded px-2 py-1.5">
                {searchPreview.keywordQuery}
              </p>
              {searchPreview.extraKeywordsDropped > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {searchPreview.extraKeywordsDropped} additional keyword
                  {searchPreview.extraKeywordsDropped === 1 ? '' : 's'} not sent — put your top roles first
                  (only the first {caps.keywordOrMax} are OR&apos;d).
                </p>
              )}
              {searchBackends.jobsSearchApi && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Phrase for Jobs Search API (space-separated)
                  </p>
                  <p className="font-mono text-xs mt-1 break-all bg-background/80 border border-border rounded px-2 py-1.5">
                    {searchPreview.jobsSearchPhrase || '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Same first {caps.keywordOrMax} keywords as above; remote-only adds{' '}
                    <span className="font-mono">remote</span>. Sent as{' '}
                    <span className="font-mono">search_term</span> to getjobs_excel.
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Location passes (up to {caps.locationPassesMax})
              </p>
              <ul className="list-disc pl-4 mt-1 text-sm">
                {searchPreview.locationRuns.map((loc) => (
                  <li key={loc}>{loc}</li>
                ))}
              </ul>
              {searchPreview.extraLocationsDropped > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {searchPreview.extraLocationsDropped} more location
                  {searchPreview.extraLocationsDropped === 1 ? '' : 's'} omitted — only the first{' '}
                  {caps.locationPassesMax} are used per run.
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                APIs (server)
              </p>
              {searchPreview.noBackends ? (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  No search backends — configure RapidAPI keys (see env docs), or restrict sources with{' '}
                  <code className="font-mono text-[10px]">BOT_SEARCH_SOURCES</code> (
                  <span className="font-mono">jsearch</span>, <span className="font-mono">jobs_search_api</span>
                  ).
                </p>
              ) : (
                <ul className="list-disc pl-4 mt-1">
                  {searchPreview.enabledPlatforms.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">JSearch posting window:</span>{' '}
              {caps.jsearchDateLabel}.
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Remote only:</span>{' '}
              {searchPreview.remoteOnly ? 'Yes (passed to APIs)' : 'No'}
            </p>
            {(searchPreview.excludeCompanies.length > 0 || searchPreview.excludeKeywords.length > 0) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Filters after fetch
                </p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc pl-4">
                  {searchPreview.excludeCompanies.length > 0 && (
                    <li>
                      Drop companies matching: {searchPreview.excludeCompanies.join(', ')}
                    </li>
                  )}
                  {searchPreview.excludeKeywords.length > 0 && (
                    <li>
                      Drop listings whose description contains:{' '}
                      {searchPreview.excludeKeywords.join(', ')}
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Then AI scoring (saved jobs only if score ≥ threshold)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Min score {searchPreview.scoringHints.minScore}/100
                {searchPreview.scoringHints.salaryMinUsd != null &&
                  ` · Min salary $${searchPreview.scoringHints.salaryMinUsd.toLocaleString()}/yr`}
                {` · Level: ${searchPreview.scoringHints.experienceLabel}`}
                {` · Up to ${searchPreview.resultsTarget} listings kept after dedup`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save settings'}
        </button>

        <button
          type="button"
          onClick={handleRunNow}
          disabled={isRunning || !searchServiceConfigured || keywords.length === 0}
          className="px-4 py-2 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-40"
        >
          {isRunning ? 'Starting…' : 'Run now'}
        </button>

        {saveMessage && <p className="text-sm text-muted-foreground">{saveMessage}</p>}
        {runMessage && <p className="text-sm text-muted-foreground">{runMessage}</p>}
      </div>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-medium text-sm">Recent runs</h2>
          </div>
          <div className="divide-y divide-border">
            {recentRuns.map((run) => {
              const pipeline = pipelineSummaryFromRun(run.errors)
              const evalSkips = evaluationSkipsFromRun(run.errors)
              return (
                <div key={run.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <StatusBadge status={run.status} />
                    <span className="text-muted-foreground text-xs flex-1 min-w-[10rem]">
                      {new Date(run.startedAt).toLocaleString()}
                      {run.source === 'manual' && ' · manual'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {run.jobsFound} from API · {run.jobsNew} saved · {run.jobsApproved} approved
                    </span>
                    {run.duration != null && (
                      <span className="text-[11px] text-muted-foreground">
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
                        AI skipped {evalSkips.length} below your min score — show model reasoning
                      </summary>
                      <ul className="mt-2 space-y-3 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
                        {evalSkips.map((s, i) => (
                          <li key={`${run.id}-eval-skip-${i}`}>
                            <p className="font-medium text-foreground leading-tight">
                              {s.title}{' '}
                              <span className="text-muted-foreground font-normal">@ {s.company}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Score {s.score}/{s.minScore}
                              {s.flags.length > 0 ? ` · ${s.flags.join(', ')}` : ''}
                            </p>
                            <p className="text-[11px] leading-snug text-foreground/90 mt-1">{s.reasoning}</p>
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
      )}
    </div>
  )
}

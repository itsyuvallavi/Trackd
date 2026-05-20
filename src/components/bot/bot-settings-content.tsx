'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { BotConfig, BotSearchFrequency } from '@prisma/client'
import {
  saveBotConfig,
  verifyTelegram,
} from '@/app/(authenticated)/settings/bot-actions'
import {
  buildBotSearchPreview,
  defaultSearchUiCaps,
} from '@/lib/bot/search-preview'
import type {
  BotSearchBackends,
  BotSearchUiCaps,
} from '@/lib/bot/search-preview'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react'

const FREQUENCY_ORDER = [
  'DAILY',
  'WEEKLY',
] as const satisfies readonly BotSearchFrequency[]

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

function supportedFrequency(frequency: BotSearchFrequency): BotSearchFrequency {
  return frequency === 'TWICE_DAILY' ? 'DAILY' : frequency
}

interface BotSettingsContentProps {
  initialConfig: BotConfig | null
  telegramConfigured: boolean
  searchServiceConfigured: boolean
  searchBackends: BotSearchBackends
  safeResumeSearchTerms?: string[]
  searchUiCaps?: BotSearchUiCaps | null
}

export function BotSettingsContent({
  initialConfig,
  telegramConfigured,
  searchServiceConfigured,
  searchBackends,
  safeResumeSearchTerms = [],
  searchUiCaps,
}: BotSettingsContentProps) {
  const caps = searchUiCaps ?? defaultSearchUiCaps()

  const [isPending, startTransition] = useTransition()
  const [isVerifying, startVerifyTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<
    { ok: boolean; msg: string } | null
  >(null)
  const [verifyMessage, setVerifyMessage] = useState('')

  const [keywords, setKeywords] = useState<string[]>(
    initialConfig?.keywords ?? []
  )
  const [locations, setLocations] = useState<string[]>(
    initialConfig?.locations ?? []
  )
  const [excludeCompanies, setExcludeCompanies] = useState<string[]>(
    initialConfig?.excludeCompanies ?? []
  )
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(
    initialConfig?.excludeKeywords ?? []
  )
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>(
    initialConfig?.spokenLanguages ?? []
  )
  const [remoteOnly, setRemoteOnly] = useState(
    initialConfig?.remoteOnly ?? false
  )
  const [experienceLevel, setExperienceLevel] = useState(
    initialConfig?.experienceLevel ?? ''
  )
  const [salaryMin, setSalaryMin] = useState<string>(
    initialConfig?.salaryMin?.toString() ?? ''
  )
  const [isActive, setIsActive] = useState(initialConfig?.isActive ?? false)
  const [frequency, setFrequency] = useState<BotSearchFrequency>(
    supportedFrequency(initialConfig?.searchFrequency ?? 'DAILY')
  )
  const [telegramChatId, setTelegramChatId] = useState(
    initialConfig?.telegramChatId ?? ''
  )
  const [minScore, setMinScore] = useState(initialConfig?.minScore ?? 60)

  // Track dirty state for the sticky save bar's "Unsaved changes" indicator.
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        keywords: initialConfig?.keywords ?? [],
        locations: initialConfig?.locations ?? [],
        excludeCompanies: initialConfig?.excludeCompanies ?? [],
        excludeKeywords: initialConfig?.excludeKeywords ?? [],
        spokenLanguages: initialConfig?.spokenLanguages ?? [],
        remoteOnly: initialConfig?.remoteOnly ?? false,
        experienceLevel: initialConfig?.experienceLevel ?? '',
        salaryMin: initialConfig?.salaryMin?.toString() ?? '',
        isActive: initialConfig?.isActive ?? false,
        frequency: supportedFrequency(initialConfig?.searchFrequency ?? 'DAILY'),
        telegramChatId: initialConfig?.telegramChatId ?? '',
        minScore: initialConfig?.minScore ?? 60,
      }),
    [initialConfig]
  )

  const currentSnapshot = JSON.stringify({
    keywords,
    locations,
    excludeCompanies,
    excludeKeywords,
    spokenLanguages,
    remoteOnly,
    experienceLevel,
    salaryMin,
    isActive,
    frequency,
    telegramChatId,
    minScore,
  })
  const isDirty = currentSnapshot !== initialSnapshot

  const searchPreview = useMemo(() => {
    const salaryParsed = (() => {
      const s = salaryMin.trim()
      if (!s) return null
      const n = parseInt(s, 10)
      return Number.isFinite(n) ? n : null
    })()
    const experienceLabel =
      EXPERIENCE_OPTIONS.find((o) => o.value === experienceLevel)?.label ??
      'Any level'
    return buildBotSearchPreview({
      keywords,
      locations,
      remoteOnly,
      experienceLabel,
      experienceLevelRaw: experienceLevel,
      excludeCompanies,
      excludeKeywords,
      salaryMinUsd: salaryParsed,
      minScore,
      backends: searchBackends,
      safeResumeSearchTerms,
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
    safeResumeSearchTerms,
    caps,
  ])

  function handleSave() {
    setSaveStatus(null)
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
      setSaveStatus(
        result.success
          ? { ok: true, msg: 'Settings saved.' }
          : { ok: false, msg: 'Failed to save.' }
      )
      setTimeout(() => setSaveStatus(null), 4000)
    })
  }

  function handleVerifyTelegram() {
    setVerifyMessage('')
    startVerifyTransition(async () => {
      const result = await verifyTelegram(telegramChatId)
      setVerifyMessage(
        result.success ? '✓ Test message sent!' : result.error ?? 'Failed.'
      )
      setTimeout(() => setVerifyMessage(''), 6000)
    })
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors'
  const labelClass = 'block text-sm font-medium mb-1.5'

  return (
    <div className="relative pb-24">
      {!searchServiceConfigured && (
        <div className="mb-5 p-3 bg-warning-bg border border-warning/30 rounded-xl text-sm text-warning-text">
          <strong>No search backends available.</strong> Add{' '}
          <code className="font-mono text-xs">JOBS_SEARCH_API_KEY</code>.
        </div>
      )}

      {/* Activation card — full-width, always on top */}
      <div className="mb-5 glass glass-subtle rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm">Bot active</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive
              ? `Runs ${FREQUENCY_LABELS[frequency].toLowerCase()}`
              : 'Bot is paused — no automatic searches'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
            isActive ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
          role="switch"
          aria-checked={isActive}
          aria-label="Toggle bot active"
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
              isActive ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* 2-column grid for the 4 setting groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Search preferences */}
        <section className="glass glass-subtle rounded-2xl px-5 py-5 space-y-4">
          <h2 className="font-semibold text-sm">Search preferences</h2>

          <TagInput
            label="Job keywords *"
            placeholder='e.g. "Frontend Engineer"'
            values={keywords}
            onChange={setKeywords}
          />

          <TagInput
            label="Locations"
            placeholder='e.g. "Lisbon", "Europe", "Remote"'
            hint={`Up to ${caps.locationPassesMax} used as separate searches. Prefer regions over cities that imply hybrid.`}
            values={locations}
            onChange={setLocations}
          />

          <div className="flex items-center gap-2">
            <input
              id="remoteOnly"
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="remoteOnly" className="text-sm">
              Remote only
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Experience level</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className={inputClass}
              >
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Min salary (USD/yr)</label>
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="80000"
                min={0}
                step={5000}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="glass glass-subtle rounded-2xl px-5 py-5 space-y-4">
          <h2 className="font-semibold text-sm">Filters</h2>

          <TagInput
            label="Exclude companies"
            placeholder='e.g. "Revature"'
            values={excludeCompanies}
            onChange={setExcludeCompanies}
          />

          <TagInput
            label="Exclude if description contains"
            placeholder='e.g. "staffing", "100% commission"'
            values={excludeKeywords}
            onChange={setExcludeKeywords}
          />

          <TagInput
            label="Languages you speak"
            hint="If a job requires a language you don't list, its score is lowered. Leave empty to disable."
            placeholder='e.g. "english", "hebrew"'
            values={spokenLanguages}
            onChange={setSpokenLanguages}
          />

          <div>
            <label className={labelClass}>
              Min AI match score:{' '}
              <strong className="tabular-nums">{minScore}/100</strong>
            </label>
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
          </div>
        </section>

        {/* Schedule */}
        <section className="glass glass-subtle rounded-2xl px-5 py-5">
          <h2 className="font-semibold text-sm mb-3">Schedule</h2>
          <div className="space-y-2">
            {FREQUENCY_ORDER.map((f) => (
              <label
                key={f}
                className={cn(
                  'flex items-center gap-2.5 cursor-pointer rounded-lg px-2.5 py-2 text-sm transition-colors',
                  frequency === f ? 'bg-primary/10' : 'hover:bg-foreground/[0.04]'
                )}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={f}
                  checked={frequency === f}
                  onChange={() => setFrequency(f)}
                  className="accent-primary"
                />
                <span>{FREQUENCY_LABELS[f]}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="glass glass-subtle rounded-2xl px-5 py-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm">Telegram notifications</h2>
            {!telegramConfigured && (
              <span className="text-[11px] text-warning-text">
                TELEGRAM_BOT_TOKEN not set
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Chat ID, e.g. 123456789"
              className={cn(inputClass, 'flex-1')}
            />
            <button
              type="button"
              onClick={handleVerifyTelegram}
              disabled={
                isVerifying ||
                !telegramChatId.trim() ||
                !telegramConfigured
              }
              className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
            >
              {isVerifying ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          {verifyMessage && (
            <p className="text-xs text-muted-foreground">{verifyMessage}</p>
          )}

          <details className="text-xs text-muted-foreground group">
            <summary className="cursor-pointer inline-flex items-center gap-1 select-none hover:text-foreground">
              <HelpCircle className="size-3.5" />
              How to get my chat ID
            </summary>
            <ol className="mt-2 space-y-1 list-decimal pl-4">
              <li>
                Message <strong>@BotFather</strong> →{' '}
                <code className="font-mono">/newbot</code> → copy the token →
                set as <code className="font-mono">TELEGRAM_BOT_TOKEN</code>
              </li>
              <li>
                Start your new bot and send{' '}
                <code className="font-mono">/start</code>
              </li>
              <li>
                Open{' '}
                <code className="font-mono">
                  https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                </code>{' '}
                → find <code className="font-mono">chat.id</code>
              </li>
              <li>Paste here and click Verify.</li>
            </ol>
          </details>
        </section>
      </div>

      {/* Collapsible search preview — auto-open once keywords exist so the
          user can sanity-check the query they'll run. */}
      <details
        className="mt-5 glass glass-subtle rounded-2xl px-5 py-4 group"
        open={searchPreview.hasKeywords}
      >
        <summary className="cursor-pointer select-none flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">Next search preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on current form — save before running to persist.
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="mt-4 text-sm">
          {!searchPreview.hasKeywords ? (
            <p className="text-muted-foreground">
              Add at least one keyword to see the query.
            </p>
          ) : (
            <div className="space-y-3">
              <KVRow label={`Keyword passes (first ${caps.keywordOrMax})`}>
                <span className="font-mono text-xs break-all">
                  {searchPreview.providerSearchTerms.join(' · ') || searchPreview.keywordQuery}
                </span>
              </KVRow>
              {safeResumeSearchTerms.length > 0 && (
                <KVRow label="Resume search terms">
                  <span className="text-xs">
                    {safeResumeSearchTerms.slice(0, caps.keywordOrMax).join(' · ')}
                  </span>
                </KVRow>
              )}
              {searchPreview.locationRuns.length > 0 && (
                <KVRow label={`Location passes (per keyword, up to ${caps.locationPassesMax})`}>
                  <span className="text-xs">
                    {searchPreview.locationRuns.join(' · ')}
                  </span>
                </KVRow>
              )}
              <KVRow label="Provider passes">
                <span className="text-xs">
                  {searchPreview.providerPassesSelected} of{' '}
                  {searchPreview.providerPassesPlanned} planned
                  {searchPreview.providerPassesCapped
                    ? ` · ${searchPreview.providerPassesDropped} capped`
                    : ''}
                </span>
              </KVRow>
              <KVRow label="APIs">
                <span className="text-xs">
                  {searchPreview.noBackends
                    ? '—'
                    : searchPreview.enabledPlatforms.join(', ')}
                </span>
              </KVRow>
              <KVRow label="Scoring">
                <span className="text-xs">
                  Min {searchPreview.scoringHints.minScore}/100
                  {searchPreview.scoringHints.salaryMinUsd != null &&
                    ` · Min $${searchPreview.scoringHints.salaryMinUsd.toLocaleString()}/yr`}
                  {` · ${searchPreview.scoringHints.experienceLabel}`}
                </span>
              </KVRow>
            </div>
          )}
        </div>
      </details>

      {/* Sticky save bar */}
      <StickySaveBar
        isDirty={isDirty}
        isPending={isPending}
        saveStatus={saveStatus}
        onSave={handleSave}
      />
    </div>
  )
}

function KVRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 items-start">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide pt-0.5">
        {label}
      </p>
      <div>{children}</div>
    </div>
  )
}

function TagInput({
  label,
  placeholder,
  hint,
  values,
  onChange,
}: {
  label: string
  placeholder: string
  hint?: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')

  function addTags(raw: string) {
    const parts = raw
      .split(/[,\/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const toAdd = parts.filter((p) => p && !values.includes(p))
    if (toAdd.length) onChange([...values, ...toAdd])
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {values.length > 0 && (
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
      )}
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
        onBlur={() => {
          if (input.trim()) addTags(input)
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
      />
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>
      )}
    </div>
  )
}

function StickySaveBar({
  isDirty,
  isPending,
  saveStatus,
  onSave,
}: {
  isDirty: boolean
  isPending: boolean
  saveStatus: { ok: boolean; msg: string } | null
  onSave: () => void
}) {
  // Portal so the bar can sit above everything and span the viewport edges,
  // not just the centered settings column. Gate on mount so SSR output matches
  // the initial client render (both render nothing) — the portal is attached
  // only after hydration to avoid a DOM mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 pointer-events-none',
        'transition-transform duration-300 ease-[var(--ease-ios)]',
        isDirty || saveStatus
          ? 'translate-y-0'
          : 'translate-y-full'
      )}
      aria-hidden={!isDirty && !saveStatus}
    >
      <div className="pointer-events-auto mx-auto max-w-5xl px-4 md:px-8 pb-4 md:pb-5 safe-area-bottom">
        <div className="glass glass-strong rounded-2xl border border-border/60 px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex-1 flex items-center gap-2">
            {saveStatus ? (
              saveStatus.ok ? (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span>{saveStatus.msg}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-4 text-error" />
                  <span>{saveStatus.msg}</span>
                </>
              )
            ) : (
              <>
                <span
                  className="size-1.5 rounded-full bg-warning"
                  aria-hidden
                />
                <span>Unsaved changes</span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
              'bg-primary text-primary-foreground transition-[transform,background-color] duration-150',
              'ease-[var(--ease-ios)] hover:bg-primary/90 active:scale-[0.98]',
              'disabled:opacity-50 disabled:hover:bg-primary disabled:active:scale-100'
            )}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

'use client'

import { useState, useTransition } from 'react'
import { BotConfig, BotRun, BotRunStatus, BotSearchFrequency } from '@prisma/client'
import { saveBotConfig, triggerBotSearch, verifyTelegram } from '@/app/(authenticated)/settings/bot-actions'
import { cn } from '@/lib/utils'

type BotRunRow = Pick<
  BotRun,
  'id' | 'status' | 'source' | 'jobsFound' | 'jobsNew' | 'jobsApproved' | 'startedAt' | 'completedAt' | 'duration' | 'errors'
>

interface BotSettingsContentProps {
  initialConfig: BotConfig | null
  recentRuns: BotRunRow[]
  telegramConfigured: boolean
  searchServiceConfigured: boolean
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

  function addTag(raw: string) {
    const trimmed = raw.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
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
            addTag(input)
          }
        }}
        onBlur={() => { if (input.trim()) addTag(input) }}
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
}: BotSettingsContentProps) {
  const [isPending, startTransition] = useTransition()
  const [isRunning, startRunTransition] = useTransition()
  const [isVerifying, startVerifyTransition] = useTransition()
  const [saveMessage, setSaveMessage] = useState('')
  const [runMessage, setRunMessage] = useState('')
  const [verifyMessage, setVerifyMessage] = useState('')

  // Form state
  const [keywords, setKeywords] = useState<string[]>(initialConfig?.keywords ?? [])
  const [locations, setLocations] = useState<string[]>(initialConfig?.locations ?? [])
  const [excludeCompanies, setExcludeCompanies] = useState<string[]>(initialConfig?.excludeCompanies ?? [])
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(initialConfig?.excludeKeywords ?? [])
  const [remoteOnly, setRemoteOnly] = useState(initialConfig?.remoteOnly ?? false)
  const [experienceLevel, setExperienceLevel] = useState(initialConfig?.experienceLevel ?? '')
  const [salaryMin, setSalaryMin] = useState<string>(initialConfig?.salaryMin?.toString() ?? '')
  const [isActive, setIsActive] = useState(initialConfig?.isActive ?? false)
  const [frequency, setFrequency] = useState<BotSearchFrequency>(
    initialConfig?.searchFrequency ?? BotSearchFrequency.DAILY
  )
  const [telegramChatId, setTelegramChatId] = useState(initialConfig?.telegramChatId ?? '')
  const [minScore, setMinScore] = useState(initialConfig?.minScore ?? 60)

  function handleSave() {
    setSaveMessage('')
    startTransition(async () => {
      const result = await saveBotConfig({
        keywords,
        locations,
        excludeCompanies,
        excludeKeywords,
        remoteOnly,
        experienceLevel,
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
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
    startRunTransition(async () => {
      const result = await triggerBotSearch()
      setRunMessage(result.success ? 'Search started! Check back in a minute.' : (result.error ?? 'Failed to start.'))
      setTimeout(() => setRunMessage(''), 6000)
    })
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

  return (
    <div className="space-y-6">
      {/* Status banners */}
      {!searchServiceConfigured && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-300">
          <strong>Search API not configured.</strong> Add at least one key to your Vercel environment variables:{' '}
          <code className="font-mono text-xs">JSEARCH_API_KEY</code> (RapidAPI → JSearch, 200 free/mo) and/or{' '}
          <code className="font-mono text-xs">SERP_API_KEY</code> (serpapi.com, 100 free/mo).
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
          placeholder='e.g. "New York" or "Remote"'
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
        </div>
      </div>

      {/* Schedule */}
      <div className="border border-border rounded-lg p-4">
        <h2 className="font-medium text-sm mb-3">Schedule</h2>
        <div className="space-y-2">
          {(Object.keys(FREQUENCY_LABELS) as BotSearchFrequency[]).map((f) => (
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
            {recentRuns.map((run) => (
              <div key={run.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <StatusBadge status={run.status} />
                <span className="text-muted-foreground text-xs flex-1">
                  {new Date(run.startedAt).toLocaleString()}
                  {run.source === 'manual' && ' · manual'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {run.jobsNew} new · {run.jobsApproved} approved
                </span>
                {run.duration && (
                  <span className="text-[11px] text-muted-foreground">
                    {(run.duration / 1000).toFixed(0)}s
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

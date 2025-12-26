'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

interface SyncLog {
  id: string
  startedAt: string
  completedAt: string | null
  duration: number | null
  source: 'manual' | 'auto' | 'cron'
  totalEmails: number
  processedEmails: number
  skippedEmails: number
  exactMatches: number
  fuzzyMatches: number
  ambiguousMatches: number
  newJobsDetected: number
  noMatches: number
  jobsUpdated: number
  notificationsCreated: number
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export function SyncHistory() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    try {
      const response = await fetch('/api/email-sync-logs')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching sync logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="size-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Sync History</h3>
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Sync History</h3>
          </div>
          <button
            onClick={fetchLogs}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">No sync history yet. Syncs will appear here after they run.</p>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Sync History</h3>
        </div>
        <button
          onClick={fetchLogs}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="border border-border rounded-lg p-4 hover:bg-primary-lightest/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {log.success ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : (
                  <XCircle className="size-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {formatDate(log.startedAt)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {log.source === 'manual' ? 'Manual' : log.source === 'cron' ? 'Auto' : 'Auto'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDuration(log.duration)}
              </span>
            </div>

            {!log.success && log.errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                Error: {log.errorMessage}
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Emails:</span>{' '}
                <span className="font-medium">{log.totalEmails}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Processed:</span>{' '}
                <span className="font-medium">{log.processedEmails}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Jobs Updated:</span>{' '}
                <span className="font-medium text-green-600">{log.jobsUpdated}</span>
              </div>
              <div>
                <span className="text-muted-foreground">New Jobs:</span>{' '}
                <span className="font-medium text-blue-600">{log.newJobsDetected}</span>
              </div>
              {log.exactMatches > 0 && (
                <div>
                  <span className="text-muted-foreground">Exact Matches:</span>{' '}
                  <span className="font-medium">{log.exactMatches}</span>
                </div>
              )}
              {log.fuzzyMatches > 0 && (
                <div>
                  <span className="text-muted-foreground">Fuzzy Matches:</span>{' '}
                  <span className="font-medium">{log.fuzzyMatches}</span>
                </div>
              )}
              {log.ambiguousMatches > 0 && (
                <div>
                  <span className="text-muted-foreground">Ambiguous:</span>{' '}
                  <span className="font-medium text-yellow-600">{log.ambiguousMatches}</span>
                </div>
              )}
              {log.noMatches > 0 && (
                <div>
                  <span className="text-muted-foreground">No Match:</span>{' '}
                  <span className="font-medium text-gray-600">{log.noMatches}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
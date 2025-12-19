'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { syncEmails } from '@/app/(authenticated)/settings/email-actions'
import { SyncResultToast } from './sync-result-toast'

export function SyncEmailsButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)

    try {
      const result = await syncEmails()

      if (result.success && result.stats) {
        // Store full stats for the toast to parse, but we'll simplify the display
        let message = `Fetched ${result.stats.totalEmails} emails since ${new Date(result.stats.syncSince).toLocaleDateString()}\n`
        message += `Processed ${result.stats.processedEmails} job-related emails\n`
        if (result.stats.createdJobs > 0) {
          message += `Created ${result.stats.createdJobs} new jobs\n`
        }
        if (result.stats.updatedJobs > 0) {
          message += `Updated ${result.stats.updatedJobs} existing jobs\n`
        }
        if (result.stats.skippedEmails > 0) {
          message += `Skipped ${result.stats.skippedEmails} emails\n`
        }
        
        setSyncResult({
          type: 'success',
          message,
        })
        setShowSyncModal(true)
      } else {
        setSyncResult({
          type: 'error',
          message: result.error || 'Sync failed. Check console for details.',
        })
        setShowSyncModal(true)
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
      setShowSyncModal(true)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <>
      <SyncResultToast
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        result={syncResult}
      />
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        variant="secondary"
      >
        {isSyncing ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Syncing...
          </>
        ) : (
          <>
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync Emails
          </>
        )}
      </Button>
    </>
  )
}

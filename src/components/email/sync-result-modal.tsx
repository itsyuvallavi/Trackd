'use client'

import { CheckCircle, XCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SyncResultModalProps {
  isOpen: boolean
  onClose: () => void
  result: {
    type: 'success' | 'error'
    message: string
  } | null
}

export function SyncResultModal({ isOpen, onClose, result }: SyncResultModalProps) {
  if (!isOpen || !result) return null

  const isSuccess = result.type === 'success'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-card border border-border p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 size-12 rounded-full flex items-center justify-center ${
              isSuccess
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {isSuccess ? (
              <CheckCircle className="size-6" />
            ) : (
              <XCircle className="size-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-lg font-semibold">
                {isSuccess ? 'Sync Complete' : 'Sync Failed'}
              </h3>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {result.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} variant="secondary" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}


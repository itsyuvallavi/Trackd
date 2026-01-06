'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { createJob } from '@/app/(authenticated)/jobs/actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface QuickAddBarProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickAddBar({ isOpen, onClose }: QuickAddBarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!company.trim() || !title.trim()) {
      setError('Company and title are required')
      return
    }

    const formData = new FormData()
    formData.set('company', company.trim())
    formData.set('title', title.trim())
    formData.set('status', 'SAVED')
    formData.set('source', 'MANUAL')

    startTransition(async () => {
      try {
        const result = await createJob(formData)
        // Reset form
        setCompany('')
        setTitle('')
        onClose()
        // Navigate to the new job
        if (result?.jobId) {
          router.push(`/jobs/${result.jobId}`)
        } else {
          router.push('/jobs')
          router.refresh()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create job')
      }
    })
  }

  const handleClose = () => {
    setCompany('')
    setTitle('')
    setError(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Quick Add Bar */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring',
              damping: 25,
              stiffness: 200
            }}
            className="fixed bottom-20 left-0 right-0 z-50 md:hidden safe-area-bottom"
          >
            <div className="bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 mx-2 mb-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Quick Add Job</h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="text"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-12 text-base"
                  autoFocus
                  disabled={isPending}
                />
                <Input
                  type="text"
                  placeholder="Job title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-12 text-base"
                  disabled={isPending}
                />

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isPending || !company.trim() || !title.trim()}
                  >
                    {isPending ? 'Adding...' : 'Add Job'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}


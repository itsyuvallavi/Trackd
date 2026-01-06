'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldContent, FieldLabel, FieldError } from '@/components/ui/field'

type FeedbackType = 'ERROR' | 'BUG' | 'FEATURE_REQUEST' | 'OTHER'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUrl?: string
}

export function FeedbackModal({ open, onOpenChange, currentUrl }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('BUG')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          url: currentUrl || window.location.href,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setSuccess(true)
      // Reset form
      setTitle('')
      setDescription('')
      setType('BUG')

      // Close modal after 1.5 seconds
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null)
      setSuccess(false)
      setTitle('')
      setDescription('')
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent size="default" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Report an Issue</AlertDialogTitle>
          <AlertDialogDescription>
            Help us improve Trackd by reporting errors, bugs, or suggesting features.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="text-green-600 dark:text-green-400 mb-2">✓</div>
            <p className="text-sm font-medium">Thank you! Your feedback has been submitted.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Field>
              <FieldLabel>Type</FieldLabel>
              <FieldContent>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as FeedbackType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="BUG">Bug Report</SelectItem>
                    <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldContent>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  disabled={isSubmitting}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide as much detail as possible..."
                  rows={5}
                  disabled={isSubmitting}
                />
              </FieldContent>
            </Field>

            {currentUrl && (
              <Field>
                <FieldLabel>Current Page</FieldLabel>
                <FieldContent>
                  <Input
                    value={currentUrl}
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                </FieldContent>
              </Field>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
                {error}
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          {success ? (
            <AlertDialogAction onClick={handleClose}>Close</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim() || !description.trim()}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


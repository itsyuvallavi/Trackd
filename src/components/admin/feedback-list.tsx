'use client'

import { useState, Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

// Define types locally to avoid Prisma client import issues
type FeedbackType = 'ERROR' | 'BUG' | 'FEATURE_REQUEST' | 'OTHER'
type FeedbackSource = 'WEB' | 'EXTENSION'
type FeedbackStatus = 'NEW' | 'REVIEWED' | 'RESOLVED'

interface Feedback {
  id: string
  userId: string | null
  userEmail: string | null
  type: FeedbackType
  source: FeedbackSource
  title: string
  description: string
  url: string | null
  userAgent: string | null
  metadata: any
  status: FeedbackStatus
  createdAt: Date | string
  updatedAt: Date | string
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

interface EnrichedFeedback extends Omit<Feedback, 'userEmail'> {
  userName?: string | null
  userEmail?: string | null | undefined
}

interface FeedbackListProps {
  feedback: EnrichedFeedback[]
}

export function FeedbackList({ feedback: initialFeedback }: FeedbackListProps) {
  const [feedback, setFeedback] = useState(initialFeedback)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'ALL'>('ALL')
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [feedbackToDelete, setFeedbackToDelete] = useState<EnrichedFeedback | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredFeedback = feedback.filter(f => {
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false
    if (typeFilter !== 'ALL' && f.type !== typeFilter) return false
    return true
  })

  const handleStatusUpdate = async (id: string, newStatus: FeedbackStatus) => {
    setUpdatingIds(prev => new Set(prev).add(id))

    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      // Update local state
      setFeedback(prev =>
        prev.map(f => (f.id === id ? { ...f, status: newStatus } : f))
      )
    } catch (error) {
      console.error('Error updating feedback status:', error)
      alert('Failed to update status. Please try again.')
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDeleteClick = (item: EnrichedFeedback) => {
    setFeedbackToDelete(item)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!feedbackToDelete) return

    setDeletingId(feedbackToDelete.id)

    try {
      const response = await fetch(`/api/feedback/${feedbackToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete feedback')
      }

      // Remove from local state
      setFeedback(prev => prev.filter(f => f.id !== feedbackToDelete.id))
      setDeleteConfirmOpen(false)
      setFeedbackToDelete(null)
    } catch (error) {
      console.error('Error deleting feedback:', error)
      alert('Failed to delete feedback. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false)
    setFeedbackToDelete(null)
  }

  const getStatusBadgeVariant = (status: FeedbackStatus) => {
    switch (status) {
      case 'NEW':
        return 'default'
      case 'REVIEWED':
        return 'secondary'
      case 'RESOLVED':
        return 'outline'
      default:
        return 'default'
    }
  }

  const getTypeBadgeVariant = (type: FeedbackType) => {
    switch (type) {
      case 'ERROR':
        return 'destructive'
      case 'BUG':
        return 'destructive'
      case 'FEATURE_REQUEST':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getTypeLabel = (type: FeedbackType) => {
    switch (type) {
      case 'ERROR':
        return 'Error'
      case 'BUG':
        return 'Bug'
      case 'FEATURE_REQUEST':
        return 'Feature'
      case 'OTHER':
        return 'Other'
    }
  }

  const getSourceLabel = (source: FeedbackSource) => {
    switch (source) {
      case 'WEB':
        return 'Web'
      case 'EXTENSION':
        return 'Extension'
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters — glass toolbar pinned feel */}
      <div className="glass glass-subtle rounded-2xl px-4 py-3 flex gap-4 items-center flex-wrap sticky top-[56px] z-20">
        <div className="flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Status
          </label>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as FeedbackStatus | 'ALL')
            }
          >
            <SelectTrigger className="w-32 rounded-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="REVIEWED">Reviewed</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Type
          </label>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as FeedbackType | 'ALL')}
          >
            <SelectTrigger className="w-32 rounded-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="BUG">Bug</SelectItem>
              <SelectItem value="FEATURE_REQUEST">Feature</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filteredFeedback.length} of {feedback.length} items
        </div>
      </div>

      {/* Table */}
      <div className="glass glass-subtle rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-32">Source</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-48">User</TableHead>
              <TableHead className="w-40">Date</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFeedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No feedback found
                </TableCell>
              </TableRow>
            ) : (
              filteredFeedback.map((item, idx) => {
                const isExpanded = expandedIds.has(item.id)
                return (
                  <Fragment key={item.id}>
                    <TableRow
                      className={`cursor-pointer transition-colors ${
                        idx % 2 === 1 ? 'bg-foreground/[0.025]' : ''
                      } hover:bg-foreground/[0.05]`}
                      onClick={() => {
                        setExpandedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(item.id)) {
                            next.delete(item.id)
                          } else {
                            next.add(item.id)
                          }
                          return next
                        })
                      }}
                    >
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadgeVariant(item.type)}>
                          {getTypeLabel(item.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {getSourceLabel(item.source)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium text-sm truncate">{item.title}</div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.url}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {item.userName && (
                            <div className="font-medium">{item.userName}</div>
                          )}
                          {item.userEmail && (
                            <div className="text-muted-foreground truncate max-w-[200px]">
                              {item.userEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), 'MMM d, yyyy')}
                          <br />
                          {format(new Date(item.createdAt), 'h:mm a')}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 items-center justify-end">
                          {item.status !== 'REVIEWED' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleStatusUpdate(item.id, 'REVIEWED' as FeedbackStatus)}
                              disabled={updatingIds.has(item.id) || deletingId === item.id}
                            >
                              {updatingIds.has(item.id) ? '...' : 'Mark Reviewed'}
                            </Button>
                          )}
                          {item.status !== 'RESOLVED' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleStatusUpdate(item.id, 'RESOLVED' as FeedbackStatus)}
                              disabled={updatingIds.has(item.id) || deletingId === item.id}
                            >
                              {updatingIds.has(item.id) ? '...' : 'Resolve'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleDeleteClick(item)}
                            disabled={updatingIds.has(item.id) || deletingId === item.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${item.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="py-4 space-y-3">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                              <div className="text-sm whitespace-pre-wrap">{item.description}</div>
                            </div>
                            {item.userAgent && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">User Agent</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.userAgent}</div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={handleDeleteCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback? This action cannot be undone.
            </AlertDialogDescription>
            {feedbackToDelete && (
              <div className="mt-4 p-3 bg-muted rounded text-sm">
                <div className="font-medium mb-1">{feedbackToDelete.title}</div>
                <div className="text-muted-foreground text-xs">
                  {feedbackToDelete.userEmail || 'Anonymous'} • {format(new Date(feedbackToDelete.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


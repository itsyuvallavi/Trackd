'use client'

import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { InterviewSession } from '@/lib/interview/types'
import { GlassPill } from '@/components/ui/glass'
import { cn } from '@/lib/utils'
import { Clock, MessageSquare, Briefcase } from 'lucide-react'

interface SessionListProps {
  sessions: Array<
    InterviewSession & {
      job?: {
        id: string
        title: string
        company: string
      } | null
      _count?: {
        messages: number
      }
    }
  >
}

// Tokenized status dot — subtle color cue without filled buttons.
const STATUS_DOT: Record<string, string> = {
  COMPLETED: 'bg-success',
  IN_PROGRESS: 'bg-interview trackd-breath',
  CANCELLED: 'bg-muted-foreground',
}

export function SessionList({ sessions }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="glass glass-subtle rounded-2xl text-center py-12 text-muted-foreground">
        <p className="text-sm">No interview sessions yet.</p>
        <p className="text-xs mt-1.5 opacity-80">
          Start a new session to begin practicing.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {sessions.map((session) => {
        const dot = STATUS_DOT[session.status] ?? 'bg-muted-foreground'
        const statusLabel = session.status.replace('_', ' ').toLowerCase()

        return (
          <li key={session.id}>
            <Link
              href={`/interview-prep/${session.id}`}
              className={cn(
                'group block glass glass-subtle rounded-2xl p-4',
                'transition-[transform,box-shadow] duration-200 ease-[var(--ease-ios)]',
                'hover:-translate-y-0.5'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      aria-hidden
                      className={cn('size-1.5 rounded-full shrink-0', dot)}
                    />
                    <span className="text-xs font-medium capitalize text-foreground/80">
                      {statusLabel}
                    </span>
                    <GlassPill
                      variant="subtle"
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {session.type.toLowerCase()}
                    </GlassPill>
                  </div>

                  {session.job && (
                    <div className="flex items-center gap-2 mb-2 text-sm text-foreground/90 group-hover:text-primary transition-colors">
                      <Briefcase className="size-3.5 text-muted-foreground" />
                      <span className="truncate">
                        {session.job.title}{' '}
                        <span className="text-muted-foreground">at</span>{' '}
                        {session.job.company}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground tabular-nums">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>
                        {session.duration
                          ? `${Math.floor(session.duration / 60)}m ${
                              session.duration % 60
                            }s`
                          : 'In progress'}
                      </span>
                    </div>
                    {session._count && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        <span>{session._count.messages} messages</span>
                      </div>
                    )}
                    <span suppressHydrationWarning>
                      {formatDistanceToNow(new Date(session.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                {session.status === 'COMPLETED' && session.completedAt && (
                  <div className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {format(new Date(session.completedAt), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

'use client'

import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { InterviewSession } from '@/lib/interview/types'
import { Badge } from '@/components/ui/badge'
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

export function SessionList({ sessions }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No interview sessions yet.</p>
        <p className="text-sm mt-2">Start a new session to begin practicing.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/interview-prep/${session.id}`}
          className="block"
        >
          <div className="bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={
                      session.status === 'COMPLETED'
                        ? 'default'
                        : session.status === 'IN_PROGRESS'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {session.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline">{session.type}</Badge>
                </div>

                {session.job && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <Briefcase className="size-4" />
                    <span>
                      {session.job.title} at {session.job.company}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3" />
                    <span>
                      {session.duration
                        ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
                        : 'In progress'}
                    </span>
                  </div>
                  {session._count && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      <span>{session._count.messages} messages</span>
                    </div>
                  )}
                  <span>
                    {formatDistanceToNow(new Date(session.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              {session.status === 'COMPLETED' && (
                <div className="text-xs text-muted-foreground">
                  {format(new Date(session.completedAt!), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}






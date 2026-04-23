'use client'

import { ResumeMessage } from '@/lib/resume/types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { User, Bot } from 'lucide-react'
import { ResumePreviewCard } from './resume-preview-card'

interface MessageBubbleProps {
  message: ResumeMessage
  sessionId?: string
  showResumeCard?: boolean
  isNewMessage?: boolean
}

export function MessageBubble({ message, sessionId, showResumeCard, isNewMessage = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Clean message content - remove fake sandbox links
  const cleanContent = message.content
    .replace(/\[View Resume\]\(sandbox:[^)]+\)/gi, '')
    .replace(/\[Download PDF\]\(sandbox:[^)]+\)/gi, '')
    .replace(/### \[View Resume\]\(sandbox:[^)]+\)/gi, '')
    .replace(/### \[Download PDF\]\(sandbox:[^)]+\)/gi, '')
    .replace(/sandbox:\/[^\s)]+/gi, '')
    .trim()

  return (
    <div
      className={cn(
        'flex gap-3 mb-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        isNewMessage && !isUser && 'animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'size-8 rounded-full flex items-center justify-center shrink-0 ring-1',
          isUser
            ? 'bg-primary/12 text-primary ring-primary/25'
            : 'bg-foreground/[0.06] text-foreground/70 ring-border/60'
        )}
      >
        {isUser ? (
          <User className="size-4" />
        ) : (
          <Bot className="size-4" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-1 max-w-[85%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary/10 text-foreground rounded-br-sm border border-primary/20'
              : 'glass glass-subtle rounded-bl-sm'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
        </div>

        {/* Resume Preview Card - shown after AI confirms generation */}
        {showResumeCard && sessionId && !isUser && (
          <ResumePreviewCard sessionId={sessionId} />
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
        </div>
      </div>
    </div>
  )
}


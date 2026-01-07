'use client'

import { InterviewMessage } from '@/lib/interview/types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { User, Bot } from 'lucide-react'

interface MessageBubbleProps {
  message: InterviewMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'size-8 rounded-full flex items-center justify-center shrink-0',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
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
          'flex flex-col gap-1 max-w-[80%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-lg px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
          {message.duration && (
            <span>• {Math.round(message.duration / 1000)}s</span>
          )}
          {message.questionType && (
            <span className="px-1.5 py-0.5 rounded bg-muted">
              {message.questionType}
            </span>
          )}
        </div>

        {/* Feedback if available */}
        {message.feedback && typeof message.feedback === 'object' && (
          <div className="mt-1 text-xs text-muted-foreground">
            {message.feedback.feedback && (
              <p>{message.feedback.feedback}</p>
            )}
            {message.feedback.suggestions && (
              <ul className="list-disc list-inside mt-1">
                {message.feedback.suggestions.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}





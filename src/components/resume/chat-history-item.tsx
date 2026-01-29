'use client'

import { FileText, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface ResumeSession {
  id: string
  resumeFileName: string
  improvedResumeText: string | null
  createdAt: string
  updatedAt: string
  messages?: Array<{
    id: string
    role: string
    content: string
    timestamp: string
  }>
}

interface ChatHistoryItemProps {
  session: ResumeSession
  isActive: boolean
  onClick: () => void
  index?: number
}

export function ChatHistoryItem({ session, isActive, onClick, index = 0 }: ChatHistoryItemProps) {
  // Extract summary from first AI message
  const getSummary = () => {
    if (session.messages && session.messages.length > 0) {
      const firstAIMessage = session.messages.find(m => m.role === 'assistant')
      if (firstAIMessage) {
        // Get first sentence or first 100 chars
        const content = firstAIMessage.content
        const firstSentence = content.split('.')[0]
        return firstSentence.length > 100 
          ? firstSentence.substring(0, 100) + '...'
          : firstSentence || 'Resume analysis'
      }
    }
    // Fallback to filename without extension
    return session.resumeFileName.replace(/\.[^/.]+$/, '') || 'Resume Chat'
  }

  const hasPDF = !!session.improvedResumeText

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  // Staggered animation - icons appear first, then content
  const iconDelay = 250 + (index * 60) // Icons appear first (250ms base + stagger)
  const contentDelay = 400 + (index * 60) // Content appears after icons

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2.5 rounded-lg border border-border transition-colors',
        'hover:bg-accent/50',
        'animate-in fade-in duration-500 ease-out',
        isActive && 'bg-muted'
      )}
      style={{
        animationDelay: `${contentDelay}ms`
      }}
    >
      <div className="flex items-start gap-2">
        <div 
          className="mt-0.5 shrink-0 animate-in fade-in zoom-in-50 duration-500 ease-out"
          style={{
            animationDelay: `${iconDelay}ms`
          }}
        >
          {hasPDF ? (
            <FileCheck className="size-3.5 text-green-500" />
          ) : (
            <FileText className="size-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5 mb-0.5">
            <p className="text-xs font-medium text-foreground line-clamp-1">
              {session.resumeFileName.replace(/\.[^/.]+$/, '')}
            </p>
            {hasPDF && (
              <span className="shrink-0 text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                PDF
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mb-1 line-clamp-2">
            {getSummary()}
          </p>
          <p className="text-[9px] text-muted-foreground">
            {formatDate(session.updatedAt)}
          </p>
        </div>
      </div>
    </button>
  )
}


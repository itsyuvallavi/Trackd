'use client'

import { useEffect, useState } from 'react'
import { ChatHistoryItem } from './chat-history-item'
import { Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

interface ChatHistorySidebarProps {
  currentSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onNewChat: () => void
  className?: string
  onCollapseChange?: (collapsed: boolean) => void
}

export function ChatHistorySidebar({ 
  currentSessionId, 
  onSessionSelect,
  onNewChat,
  className,
  onCollapseChange
}: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ResumeSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
    onCollapseChange?.(collapsed)
  }

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch('/api/resume/chat/sessions')
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
        }
      } catch (error) {
        console.error('Error fetching sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSessions()
  }, [])

  // Refresh sessions when current session changes (new chat created or selected)
  useEffect(() => {
    async function refreshSessions() {
      try {
        const response = await fetch('/api/resume/chat/sessions')
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
        }
      } catch (error) {
        console.error('Error refreshing sessions:', error)
      }
    }
    
    // Refresh after a short delay to allow for server-side updates
    const timeoutId = setTimeout(refreshSessions, 500)
    
    return () => clearTimeout(timeoutId)
  }, [currentSessionId])

  if (isCollapsed) {
    return (
      <div className={cn(
        'w-8 border-l border-border bg-card flex flex-col fixed right-0 top-[64px] bottom-0 h-[calc(100vh-64px)] z-30',
        'transition-all duration-500 ease-out',
        'animate-in slide-in-from-right-full',
        className
      )}>
        <div className="bg-card border-b border-border px-2 pt-6 pb-2.5 flex items-center justify-center shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 rotate-180 transition-transform duration-500 ease-out"
            onClick={() => handleCollapse(false)}
            aria-label="Expand history"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'w-[266px] border-l border-border bg-card flex flex-col fixed right-0 top-[64px] bottom-0 h-[calc(100vh-64px)] z-30',
      'transition-all duration-500 ease-out',
      'animate-in slide-in-from-right-full',
      className
    )}>
      {/* Header with Minimize Button - Add top padding for even spacing from top bar */}
      <div className="bg-card border-b border-border px-3 pt-6 pb-2.5 flex items-center justify-between z-10 shrink-0">
        <span className="text-xs font-medium text-foreground">History</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 transition-transform duration-500 ease-out"
          onClick={() => handleCollapse(true)}
          aria-label="Minimize history"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Sessions List - Independently scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 animate-in fade-in duration-500 delay-100 ease-out">
        <div className="p-3 space-y-2">
          {/* New Chat Button - First item in scrollable area */}
          <button
            onClick={onNewChat}
            className="w-full px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors border border-transparent"
          >
            + New Chat
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <p>No chat history yet</p>
              <p className="text-xs mt-1">Start a new chat to get feedback</p>
            </div>
          ) : (
            sessions.map((session, index) => (
              <ChatHistoryItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onClick={() => onSessionSelect(session.id)}
                index={index}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}


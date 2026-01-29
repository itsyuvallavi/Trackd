'use client'

import { useState, useEffect, useRef } from 'react'
import { useResumeChat } from '@/hooks/use-resume-chat'
import { MessageBubble } from './message-bubble'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResumeMessage } from '@/lib/resume/types'

interface ResumeChatProps {
  sessionId: string | null
  onUploadRequested?: () => void
  onCreateRequested?: () => void
}

export function ResumeChat({ sessionId, onUploadRequested, onCreateRequested }: ResumeChatProps) {
  // Always call hook (React rules), but handle empty sessionId inside
  const {
    messages,
    isLoading,
    resumeReadyMessageId,
    sendMessage,
    loadMessages,
  } = useResumeChat({ sessionId: sessionId || '' })

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [animatedMessageIds, setAnimatedMessageIds] = useState<Set<string>>(new Set())
  const previousMessageIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef<boolean>(true)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Track new messages for animation - only animate AI responses
  useEffect(() => {
    if (isInitialLoadRef.current) {
      // First load - mark all existing message IDs and skip animation
      if (messages.length > 0) {
        const ids = new Set(messages.map((m: ResumeMessage) => m.id))
        previousMessageIdsRef.current = ids
        isInitialLoadRef.current = false
      }
      return
    }

    // Find new messages that weren't in previous set
    const currentIds = new Set(messages.map((m: ResumeMessage) => m.id))
    const previousIds = previousMessageIdsRef.current
    const newMessageIds = new Set(
      Array.from(currentIds).filter((id) => !previousIds.has(id))
    )

    if (newMessageIds.size > 0) {
      // Find new AI messages
      const newAIMessages = messages.filter(
        (m: ResumeMessage) => newMessageIds.has(m.id) && m.role === 'assistant'
      )

      // Animate new AI messages
      if (newAIMessages.length > 0) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          newAIMessages.forEach((aiMessage: ResumeMessage) => {
            setAnimatedMessageIds((prev) => {
              const updated = new Set(prev)
              updated.add(aiMessage.id)
              
              // Remove animation flag after animation completes
              setTimeout(() => {
                setAnimatedMessageIds((current) => {
                  const filtered = new Set(current)
                  filtered.delete(aiMessage.id)
                  return filtered
                })
              }, 600)
              
              return updated
            })
          })
        })
      }

      // Update previous message IDs
      previousMessageIdsRef.current = currentIds
    }
  }, [messages])

  useEffect(() => {
    if (sessionId) {
      // Reset when session changes
      setAnimatedMessageIds(new Set())
      previousMessageIdsRef.current = new Set()
      isInitialLoadRef.current = true
      loadMessages()
    }
  }, [sessionId, loadMessages])

  // Show initial greeting when no session
  if (!sessionId) {
    return (
      <div className="flex flex-col h-[calc(100vh-240px)] border border-border rounded-lg bg-card">
        <div className="flex-1 overflow-y-auto p-6 pb-2 min-h-0">
          {/* AI greeting message */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-sm font-medium">AI</span>
            </div>
            <div className="flex-1 space-y-3">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-foreground mb-3">
                  Hi! I'm your Resume Advisor. I can help you improve your resume in two ways:
                </p>
                <div className="space-y-2">
                  <button
                    onClick={onUploadRequested}
                    className="w-full text-left px-4 py-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Upload className="size-4 text-primary" />
                      <span className="font-medium text-sm">Upload Existing Resume</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      I'll analyze it and suggest improvements
                    </span>
                  </button>
                  <button
                    onClick={onCreateRequested}
                    className="w-full text-left px-4 py-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="size-4 text-primary" />
                      <span className="font-medium text-sm">Create New Resume</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      I'll ask you questions and build a resume for you
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    await sendMessage(userMessage)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] border border-border rounded-lg bg-card">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 pb-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center max-w-md">
              <p className="text-lg font-medium mb-2">Resume Analysis Ready</p>
              <p className="text-sm">
                I've analyzed your resume. Ask me questions or request improvements!
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isNewMessage = animatedMessageIds.has(message.id)
            
            return (
              <MessageBubble 
                key={message.id} 
                message={message}
                sessionId={sessionId}
                showResumeCard={message.id === resumeReadyMessageId}
                isNewMessage={isNewMessage}
              />
            )
          })
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-3 pt-4">
        <div className="relative flex items-center justify-center gap-2">
          {/* Input Field */}
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything about your resume or say 'generate my resume' to create an improved version..."
              className={cn(
                "min-h-[56px] max-h-[200px] resize-none rounded-lg",
                "bg-background border-border",
                "text-sm placeholder:text-muted-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
              )}
              disabled={isLoading}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2.5",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "shadow-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all"
            )}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}


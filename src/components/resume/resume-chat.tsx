'use client'

import { useState, useEffect, useRef } from 'react'
import { useResumeChat } from '@/hooks/use-resume-chat'
import { MessageBubble } from './message-bubble'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResumeChatProps {
  sessionId: string
}

export function ResumeChat({ sessionId }: ResumeChatProps) {
  const {
    messages,
    isLoading,
    resumeReadyMessageId,
    sendMessage,
    loadMessages,
  } = useResumeChat({ sessionId })

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadMessages()
  }, [sessionId, loadMessages])

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
    <div className="flex flex-col h-[calc(100vh-200px)] border border-border rounded-lg bg-card">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
          messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message}
              sessionId={sessionId}
              showResumeCard={message.id === resumeReadyMessageId}
            />
          ))
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
      <div className="border-t border-border bg-card p-4">
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


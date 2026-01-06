'use client'

import { useState, useEffect, useRef } from 'react'
import { useInterviewSession } from '@/hooks/use-interview-session'
import { MessageBubble } from './message-bubble'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Play, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceChatProps {
  sessionId: string
  onSummaryGenerated?: (summary: any) => void
}

export function VoiceChat({ sessionId, onSummaryGenerated }: VoiceChatProps) {
  const {
    messages,
    isListening,
    isSpeaking,
    isLoading,
    currentQuestion,
    startListening,
    stopListening,
    speak,
    getNextQuestion,
    generateSummary,
  } = useInterviewSession({
    sessionId,
    onQuestionGenerated: (question) => {
      // Auto-speak the question
      speak(question)
    },
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'completed'>('idle')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Auto-start with first question if no messages
    if (messages.length === 0 && sessionStatus === 'idle') {
      handleStartInterview()
    }
  }, [])

  const handleStartInterview = async () => {
    setSessionStatus('active')
    await getNextQuestion()
  }

  const handleStopListening = () => {
    stopListening()
  }

  const handleStartListening = () => {
    if (!currentQuestion) {
      alert('Please wait for a question first')
      return
    }
    startListening()
  }

  const handleNextQuestion = async () => {
    await getNextQuestion()
  }

  const handleEndSession = async () => {
    if (confirm('End interview session and generate summary?')) {
      const summary = await generateSummary()
      setSessionStatus('completed')
      if (onSummaryGenerated && summary) {
        onSummaryGenerated(summary)
      }
    }
  }

  const canStartListening = sessionStatus === 'active' && currentQuestion && !isListening && !isSpeaking
  const canGetNextQuestion = sessionStatus === 'active' && !isLoading && !isListening

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Ready to start?</p>
              <p className="text-sm">Click "Start Interview" to begin</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="border-t border-border bg-card p-4">
        <div className="flex items-center justify-center gap-3">
          {sessionStatus === 'idle' && (
            <Button onClick={handleStartInterview} size="lg">
              <Play className="size-4 mr-2" />
              Start Interview
            </Button>
          )}

          {sessionStatus === 'active' && (
            <>
              <Button
                onClick={isListening ? handleStopListening : handleStartListening}
                disabled={!canStartListening}
                variant={isListening ? 'destructive' : 'default'}
                size="lg"
                className={cn(
                  isListening && 'animate-pulse'
                )}
              >
                {isListening ? (
                  <>
                    <MicOff className="size-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="size-4 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>

              <Button
                onClick={handleNextQuestion}
                disabled={!canGetNextQuestion}
                variant="outline"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-2" />
                    Next Question
                  </>
                )}
              </Button>

              <Button
                onClick={handleEndSession}
                variant="outline"
                size="lg"
              >
                <Square className="size-4 mr-2" />
                End Session
              </Button>
            </>
          )}

          {sessionStatus === 'completed' && (
            <div className="text-center text-muted-foreground">
              <p>Session completed. Summary generated.</p>
            </div>
          )}
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          {isListening && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-red-500 animate-pulse" />
              <span>Listening...</span>
            </div>
          )}
          {isSpeaking && (
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
              <span>AI Speaking...</span>
            </div>
          )}
          {isLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


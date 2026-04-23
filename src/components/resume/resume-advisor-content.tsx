'use client'

import { useState } from 'react'
import { ResumeChat } from './resume-chat'
import { ResumeUpload } from './resume-upload'
import { ChatHistorySidebar } from './chat-history-sidebar'

interface ResumeAdvisorContentProps {
  /** False when OPENAI_API_KEY is missing (server-side check). */
  aiConfigured?: boolean
}

export function ResumeAdvisorContent({ aiConfigured = true }: ResumeAdvisorContentProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false)

  const handleResumeUploaded = async (uploadedSessionId: string) => {
    setSessionId(uploadedSessionId)
    setIsInitializing(true)
    setShowUpload(false)
    
    // Initialize AI analysis for the session
    try {
      const response = await fetch('/api/resume/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: uploadedSessionId }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(
          (errorData as { userMessage?: string; message?: string; error?: string }).userMessage ||
            (errorData as { message?: string }).message ||
            (errorData as { error?: string }).error ||
            'Failed to initialize AI analysis'
        )
      }
      
      // Trigger a refresh by updating sessionId (which will refresh the sidebar)
      setSessionId(uploadedSessionId)
    } catch (error) {
      console.error('Error initializing session:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize AI analysis. Please try again.'
      alert(errorMessage)
    } finally {
      setIsInitializing(false)
    }
  }

  const handleNewChat = () => {
    setSessionId(null)
    setIsInitializing(false)
    setShowUpload(false)
  }

  const handleSessionSelect = (selectedSessionId: string) => {
    setSessionId(selectedSessionId)
    setShowUpload(false)
    setIsInitializing(false)
  }

  const configBanner =
    !aiConfigured ? (
      <div
        className="mb-4 glass glass-subtle rounded-2xl border-warning/30 bg-warning-bg/50 px-4 py-3 text-sm text-foreground"
        role="status"
      >
        Resume analysis is not available: the server is missing{' '}
        <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 text-xs">
          OPENAI_API_KEY
        </code>
        . Add it to your environment and redeploy to enable uploads and AI feedback.
      </div>
    ) : null

  // Show upload component when user clicks upload
  if (showUpload && !sessionId) {
    return (
      <>
        {/* Main Content - Scrollable container matching jobs page structure */}
        <div className="flex-1 overflow-auto">
          <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
            <div className="w-full max-w-[1160px]">
              <div className="mb-4">
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-2 transition-colors"
                >
                  ← Back to chat
                </button>
                <h1 className="text-3xl font-semibold tracking-tight mb-1">
                  Resume advisor
                </h1>
                <p className="text-sm text-muted-foreground">
                  Upload your resume to get started.
                </p>
              </div>
              {configBanner}
              <ResumeUpload onResumeUploaded={handleResumeUploaded} disabled={!aiConfigured} />
            </div>
          </div>
        </div>

        {/* Chat History Sidebar - Desktop only, rendered as sibling (like dashboard) */}
        <div className="hidden lg:block">
          <ChatHistorySidebar
            currentSessionId={sessionId}
            onSessionSelect={handleSessionSelect}
            onNewChat={handleNewChat}
            onCollapseChange={setIsHistoryCollapsed}
          />
        </div>
      </>
    )
  }

  // Show chat interface - either with session or initial greeting
  return (
    <>
      {/* Main Content - Scrollable container matching jobs page structure */}
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
          <div className="w-full max-w-[1160px]">
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-3xl font-semibold tracking-tight mb-1">
                Resume advisor
              </h1>
              <p className="text-sm text-muted-foreground">
                {sessionId
                  ? 'Chat with AI about your resume.'
                  : 'Get AI-powered feedback on your resume.'}
              </p>
            </div>

            {configBanner}

            {/* Content */}
            {isInitializing ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Initializing AI analysis...</p>
              </div>
            ) : (
              <>
                {!sessionId ? (
                  // Initial greeting - AI asks user what they want
                  <ResumeChat 
                    sessionId={null} 
                    onUploadRequested={() => setShowUpload(true)}
                    onCreateRequested={() => {
                      // Handle creating new resume via chat
                      // AI will ask questions and build resume
                    }}
                  />
                ) : (
                  <ResumeChat sessionId={sessionId} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat History Sidebar - Desktop only, rendered as sibling (like dashboard) */}
      <div className="hidden lg:block">
        <ChatHistorySidebar
          currentSessionId={sessionId}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onCollapseChange={setIsHistoryCollapsed}
        />
      </div>
    </>
  )
}


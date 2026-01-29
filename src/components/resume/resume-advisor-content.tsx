'use client'

import { useState } from 'react'
import { ResumeChat } from './resume-chat'
import { ResumeUpload } from './resume-upload'
import { ChatHistorySidebar } from './chat-history-sidebar'

export function ResumeAdvisorContent() {
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
        throw new Error(errorData.message || errorData.error || 'Failed to initialize AI analysis')
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
                  className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-2"
                >
                  ← Back to chat
                </button>
                <h1 className="text-2xl font-semibold mb-2">Resume Advisor</h1>
                <p className="text-sm text-muted-foreground">Upload your resume to get started</p>
              </div>
              <ResumeUpload onResumeUploaded={handleResumeUploaded} />
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
              <h1 className="text-2xl font-semibold mb-2">Resume Advisor</h1>
              <p className="text-sm text-muted-foreground">
                {sessionId ? 'Chat with AI about your resume' : 'Get AI-powered feedback on your resume'}
              </p>
            </div>

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


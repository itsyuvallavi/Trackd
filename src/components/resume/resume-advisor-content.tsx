'use client'

import { useState } from 'react'
import { ResumeChat } from './resume-chat'
import { ResumeUpload } from './resume-upload'
import { FileText } from 'lucide-react'

export function ResumeAdvisorContent() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  const handleResumeUploaded = async (uploadedSessionId: string) => {
    setSessionId(uploadedSessionId)
    setIsInitializing(true)
    
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
    } catch (error) {
      console.error('Error initializing session:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize AI analysis. Please try again.'
      alert(errorMessage)
    } finally {
      setIsInitializing(false)
    }
  }

  const handleNewResume = () => {
    setSessionId(null)
    setIsInitializing(false)
  }

  if (!sessionId) {
    return (
      <div>
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-semibold">Resume Advisor</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Get AI-powered feedback and suggestions to improve your resume</p>
        </div>
        
        <ResumeUpload onResumeUploaded={handleResumeUploaded} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Resume Advisor</h1>
          <p className="text-muted-foreground">
            Chat with AI to improve your resume
          </p>
        </div>
        <button
          onClick={handleNewResume}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
        >
          <FileText className="size-4" />
          Upload New Resume
        </button>
      </div>

      {isInitializing ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Initializing AI analysis...</p>
        </div>
      ) : (
        <ResumeChat sessionId={sessionId} />
      )}
    </div>
  )
}


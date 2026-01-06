'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { JobSelector } from './job-selector'
import { VoiceChat } from './voice-chat'
import { SessionList } from './session-list'
import { SessionSummary } from './session-summary'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InterviewType, InterviewSessionStatus } from '@prisma/client'
import { createInterviewSession } from '@/app/(authenticated)/interview-prep/actions'
import { MessageSquare, Plus } from 'lucide-react'
import { SessionSummary as SummaryType } from '@/lib/interview/types'

interface Job {
  id: string
  title: string
  company: string
  status: string
}

interface Session {
  id: string
  userId: string
  jobId?: string | null
  type: InterviewType
  status: InterviewSessionStatus
  startedAt: Date
  completedAt?: Date | null
  duration?: number | null
  summary?: string | null
  strengths: string[]
  improvements: string[]
  tips: string[]
  createdAt: Date
  updatedAt: Date
  job?: {
    id: string
    title: string
    company: string
  } | null
  _count?: {
    messages: number
  }
}

interface InterviewPrepPageContentProps {
  jobs: Job[]
  sessions: Session[]
}

export function InterviewPrepPageContent({
  jobs,
  sessions,
}: InterviewPrepPageContentProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>()
  const [interviewType, setInterviewType] = useState<InterviewType>('MIXED')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [summary, setSummary] = useState<SummaryType | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [view, setView] = useState<'list' | 'session'>('list')

  const handleStartNewSession = async () => {
    setIsCreatingSession(true)
    try {
      const result = await createInterviewSession(selectedJobId, interviewType)
      setCurrentSessionId(result.sessionId)
      setView('session')
      setSummary(null)
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Failed to create interview session')
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleSummaryGenerated = (generatedSummary: SummaryType) => {
    setSummary(generatedSummary)
  }

  const handleBackToList = () => {
    setView('list')
    setCurrentSessionId(null)
    setSummary(null)
  }

  if (view === 'session' && currentSessionId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Interview Prep</h1>
          <Button onClick={handleBackToList} variant="outline">
            Back to Sessions
          </Button>
        </div>

        {summary ? (
          <SessionSummary
            summary={summary}
            onRetry={handleStartNewSession}
            onSave={handleBackToList}
          />
        ) : (
          <div className="bg-card border border-border rounded-lg h-[600px]">
            <VoiceChat
              sessionId={currentSessionId}
              onSummaryGenerated={handleSummaryGenerated}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interview Prep</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Practice with AI-powered voice interviews
          </p>
        </div>
      </div>

      {/* New Session Setup */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="size-5" />
          Start New Session
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Job (Optional)</label>
            <JobSelector
              value={selectedJobId}
              onValueChange={setSelectedJobId}
              jobs={jobs}
            />
            <p className="text-xs text-muted-foreground">
              Link to a specific job for personalized questions
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Interview Type</label>
            <Select
              value={interviewType}
              onValueChange={(value) => setInterviewType(value as InterviewType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MIXED">Mixed (Technical + General)</SelectItem>
                <SelectItem value="TECHNICAL">Technical</SelectItem>
                <SelectItem value="GENERAL">General</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the type of interview questions
            </p>
          </div>
        </div>

        <Button
          onClick={handleStartNewSession}
          disabled={isCreatingSession}
          size="lg"
          className="w-full"
        >
          <MessageSquare className="size-4 mr-2" />
          {isCreatingSession ? 'Creating Session...' : 'Start Interview Session'}
        </Button>
      </div>

      {/* Past Sessions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Past Sessions</h2>
        <SessionList sessions={sessions} />
      </div>
    </div>
  )
}


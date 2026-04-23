'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GlassPanel, Aurora } from '@/components/ui/glass'
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
import { MessageSquare, Plus, ArrowLeft } from 'lucide-react'
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

  // Live session — chromeless, focused layout with floating controls.
  if (view === 'session' && currentSessionId) {
    return (
      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={handleBackToList}
            variant="ghost"
            size="sm"
            className="h-8 -ml-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            <span className="text-xs md:text-sm">Back to sessions</span>
          </Button>
        </div>

        {summary ? (
          <SessionSummary
            summary={summary}
            onRetry={handleStartNewSession}
            onSave={handleBackToList}
          />
        ) : (
          <GlassPanel className="rounded-3xl h-[640px] overflow-hidden p-0">
            <VoiceChat
              sessionId={currentSessionId}
              onSummaryGenerated={handleSummaryGenerated}
            />
          </GlassPanel>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-50 -z-10">
        <Aurora />
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Interview prep
          </h1>
          <p className="text-sm text-muted-foreground">
            Practice with AI-powered voice interviews.
          </p>
        </div>

        {/* New Session Setup */}
        <GlassPanel className="rounded-3xl p-5 md:p-7 space-y-5">
          <h2 className="text-sm md:text-base font-semibold tracking-tight flex items-center gap-2 text-foreground/80">
            <Plus className="size-4" />
            Start new session
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Job (optional)
              </label>
              <JobSelector
                value={selectedJobId}
                onValueChange={setSelectedJobId}
                jobs={jobs}
              />
              <p className="text-xs text-muted-foreground">
                Link to a specific job for personalized questions.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Interview type
              </label>
              <Select
                value={interviewType}
                onValueChange={(value) =>
                  setInterviewType(value as InterviewType)
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MIXED">Mixed (technical + general)</SelectItem>
                  <SelectItem value="TECHNICAL">Technical</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the type of questions the AI will ask.
              </p>
            </div>
          </div>

          <Button
            onClick={handleStartNewSession}
            disabled={isCreatingSession}
            size="lg"
            className="w-full rounded-2xl"
          >
            <MessageSquare className="size-4 mr-2" />
            {isCreatingSession
              ? 'Creating session…'
              : 'Start interview session'}
          </Button>
        </GlassPanel>

        {/* Past Sessions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Past sessions</h2>
          <SessionList sessions={sessions} />
        </div>
      </div>
    </div>
  )
}

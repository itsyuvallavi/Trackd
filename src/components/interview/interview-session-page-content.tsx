'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { VoiceChat } from './voice-chat'
import { SessionSummary } from './session-summary'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SessionSummary as SummaryType } from '@/lib/interview/types'

interface Session {
  id: string
  type: string
  status: string
  summary?: string | null
  strengths: string[]
  improvements: string[]
  tips: string[]
  messages: Array<{
    id: string
    role: string
    content: string
    timestamp: Date
  }>
}

interface InterviewSessionPageContentProps {
  session: Session
}

export function InterviewSessionPageContent({
  session,
}: InterviewSessionPageContentProps) {
  const router = useRouter()
  const [summary, setSummary] = useState<SummaryType | null>(
    session.summary
      ? {
          summary: session.summary,
          strengths: session.strengths,
          improvements: session.improvements,
          tips: session.tips,
        }
      : null
  )

  const handleSummaryGenerated = (generatedSummary: SummaryType) => {
    setSummary(generatedSummary)
  }

  if (summary) {
    return (
      <div className="space-y-6">
        <Button
          onClick={() => router.push('/interview-prep')}
          variant="outline"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Sessions
        </Button>

        <SessionSummary
          summary={summary}
          onRetry={() => router.push('/interview-prep')}
          onSave={() => router.push('/interview-prep')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button
        onClick={() => router.push('/interview-prep')}
        variant="outline"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back to Sessions
      </Button>

      <div className="bg-card border border-border rounded-lg h-[600px]">
        <VoiceChat
          sessionId={session.id}
          onSummaryGenerated={handleSummaryGenerated}
        />
      </div>
    </div>
  )
}


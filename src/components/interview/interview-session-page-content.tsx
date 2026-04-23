'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GlassPanel } from '@/components/ui/glass'
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

  const backButton = (
    <Button
      onClick={() => router.push('/interview-prep')}
      variant="ghost"
      size="sm"
      className="h-8 -ml-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
    >
      <ArrowLeft className="size-4 mr-1.5" />
      <span className="text-xs md:text-sm">Back to sessions</span>
    </Button>
  )

  if (summary) {
    return (
      <div className="space-y-4">
        {backButton}
        <SessionSummary
          summary={summary}
          onRetry={() => router.push('/interview-prep')}
          onSave={() => router.push('/interview-prep')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {backButton}
      <GlassPanel className="rounded-3xl h-[640px] overflow-hidden p-0">
        <VoiceChat
          sessionId={session.id}
          onSummaryGenerated={handleSummaryGenerated}
        />
      </GlassPanel>
    </div>
  )
}

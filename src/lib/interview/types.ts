import { InterviewType, InterviewSessionStatus } from '@prisma/client'

export interface JobContext {
  id: string
  title: string
  company: string
  location?: string | null
  notes?: string | null
  url?: string | null
  interviewAt?: Date | null
}

export interface InterviewMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  audioUrl?: string | null
  timestamp: Date
  duration?: number | null
  questionType?: string | null
  feedback?: any
}

export interface InterviewSession {
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
}

export interface QuestionResponse {
  question: string
  type: string
  feedback?: any
}

export interface ResponseAnalysis {
  feedback: string
  score?: number
  suggestions?: string[]
}

export interface SessionSummary {
  summary: string
  strengths: string[]
  improvements: string[]
  tips: string[]
}


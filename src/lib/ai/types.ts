/**
 * TypeScript types for AI service
 */

export interface AIConfig {
  apiKey: string
  model: string
  maxRetries: number
  timeout: number
  temperature: number
}

export interface AIResponse<T = unknown> {
  data: T
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost?: number
}

export interface ClassificationResult {
  type: EmailType
  confidence: number
  reasoning: string
  shouldProcess: boolean
}

export enum EmailType {
  APPLICATION_CONFIRMATION = 'APPLICATION_CONFIRMATION',
  INTERVIEW_INVITE = 'INTERVIEW_INVITE',
  REJECTION = 'REJECTION',
  OFFER = 'OFFER',
  FOLLOW_UP = 'FOLLOW_UP',
  OTHER = 'OTHER',
}

export interface ExtractedEntities {
  company: string | null
  title: string | null
  location: string | null
  interviewDate?: string | null
  interviewTime?: string | null
  nextSteps?: string[]
  contactName?: string | null
  contactEmail?: string | null
  salary?: string | null
  rejectionReason?: string | null
}

export interface MatchResult {
  jobId: string | null
  confidence: number
  reasoning: string
  requiresUserInput: boolean
  alternativeMatches?: Array<{ jobId: string; confidence: number; title: string; company: string }>
}

export interface AIError {
  message: string
  code?: string
  retryable: boolean
}


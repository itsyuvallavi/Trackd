/**
 * AI-Powered Email Classifier
 * 
 * Replaces the keyword-based EmailClassifier with AI-powered classification
 * using GPT-4o-mini.
 */

import { EmailMessage } from './email-service'
import { JobStatus } from '@prisma/client'
import { getAIClient } from './ai/client'
import { getEmailReviewPrompt } from './ai/prompts/email-review'
import { EmailReviewResult, EmailType, ExtractedEntities } from './ai/types'

// Re-export types for compatibility with existing code
export { EmailType } from './ai/types'

// Match the existing ClassifiedEmail interface for compatibility
export interface ClassifiedEmail {
  type: EmailType
  confidence: number
  jobInfo?: {
    title?: string
    company?: string
    location?: string
  }
  suggestedStatus?: JobStatus
  metadata: {
    keywords: string[] // Keep for compatibility, but will be empty for AI
    reasoning?: string // AI-specific
    shouldProcess?: boolean // AI-specific
    extractedEntities?: ExtractedEntities // AI-specific: full extracted context
  }
}

export class AIClassifier {
  private client = getAIClient()

  /**
   * Classify an email and extract job-related information
   */
  async classify(email: EmailMessage): Promise<ClassifiedEmail> {
    try {
      const reviewPrompt = getEmailReviewPrompt(email)
      const reviewResponse = await this.client.chatCompletion([
        {
          role: 'user',
          content: reviewPrompt,
        },
      ])

      const reviewContent =
        reviewResponse.data.choices[0]?.message?.content
      if (!reviewContent) {
        throw new Error('No response from AI email review')
      }

      const review: EmailReviewResult = JSON.parse(reviewContent)
      const extracted = normalizeExtractedEntities(review.extractedEntities)

      if (!review.shouldProcess) {
        return {
          type: review.type as EmailType,
          confidence: review.confidence,
          jobInfo: undefined,
          metadata: {
            keywords: [],
            reasoning: review.reasoning,
            shouldProcess: false,
            extractedEntities: extracted,
          },
        }
      }

      const suggestedStatus = this.mapEmailTypeToStatus(
        review.type as EmailType
      )

      return {
        type: review.type as EmailType,
        confidence: review.confidence,
        jobInfo: {
          company: extracted.company || undefined,
          title: extracted.title || undefined,
          location: extracted.location || undefined,
        },
        suggestedStatus,
        metadata: {
          keywords: [], // Empty for AI classifier
          reasoning: review.reasoning,
          shouldProcess: true,
          // Store full extracted entities for use in Activity metadata
          extractedEntities: extracted,
        },
      }
    } catch (error) {
      console.error('AI classification error:', error)
      return {
        type: EmailType.OTHER,
        confidence: 0,
        metadata: {
          keywords: [],
          reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          shouldProcess: false,
        },
      }
    }
  }

  /**
   * Map email type to suggested job status
   */
  private mapEmailTypeToStatus(type: EmailType): JobStatus | undefined {
    switch (type) {
      case EmailType.APPLICATION_CONFIRMATION:
        return JobStatus.APPLIED
      case EmailType.INTERVIEW_INVITE:
        return JobStatus.INTERVIEW
      case EmailType.REJECTION:
        return JobStatus.REJECTED
      case EmailType.OFFER:
        return JobStatus.OFFER
      default:
        return undefined
    }
  }

  /**
   * Get AI usage statistics
   */
  getStats() {
    return this.client.getStats()
  }
}

function normalizeExtractedEntities(value: ExtractedEntities | null | undefined): ExtractedEntities {
  return {
    company: value?.company || null,
    title: value?.title || null,
    location: value?.location || null,
    interviewDate: value?.interviewDate || null,
    interviewTime: value?.interviewTime || null,
    nextSteps: Array.isArray(value?.nextSteps) ? value.nextSteps : [],
    contactName: value?.contactName || null,
    contactEmail: value?.contactEmail || null,
    salary: value?.salary || null,
    rejectionReason: value?.rejectionReason || null,
  }
}

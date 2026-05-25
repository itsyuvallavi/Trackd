/**
 * AI-Powered Email Classifier
 * 
 * Replaces the keyword-based EmailClassifier with AI-powered classification
 * using GPT-4o-mini.
 */

import { EmailMessage } from './email-service'
import { JobStatus } from '@prisma/client'
import { getAIClient } from './ai/client'
import { getClassificationPrompt } from './ai/prompts/classification'
import { getExtractionPrompt } from './ai/prompts/extraction'
import { ClassificationResult, EmailType, ExtractedEntities } from './ai/types'
import {
  EmailClassifier as DeterministicEmailClassifier,
  EmailType as DeterministicEmailType,
} from './email-classifier'

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
  private deterministic = new DeterministicEmailClassifier()

  /**
   * Classify an email and extract job-related information
   */
  async classify(email: EmailMessage): Promise<ClassifiedEmail> {
    try {
      // Step 1: Classify the email
      const classificationPrompt = getClassificationPrompt(email)
      const classificationResponse = await this.client.chatCompletion([
        {
          role: 'user',
          content: classificationPrompt,
        },
      ])

      const classificationContent =
        classificationResponse.data.choices[0]?.message?.content
      if (!classificationContent) {
        throw new Error('No response from AI classification')
      }

      const classification: ClassificationResult = JSON.parse(
        classificationContent
      )

      // Step 2: If shouldProcess is false, return early (don't extract)
      if (!classification.shouldProcess) {
        const fallback = this.deterministicFallback(email, classification.reasoning)
        if (fallback) return fallback

        return {
          type: classification.type as EmailType,
          confidence: classification.confidence,
          metadata: {
            keywords: [], // Empty for AI classifier
            reasoning: classification.reasoning,
            shouldProcess: false,
          },
        }
      }

      // Step 3: Extract entities if we should process
      const extractionPrompt = getExtractionPrompt(email)
      const extractionResponse = await this.client.chatCompletion([
        {
          role: 'user',
          content: extractionPrompt,
        },
      ])

      const extractionContent =
        extractionResponse.data.choices[0]?.message?.content
      if (!extractionContent) {
        throw new Error('No response from AI extraction')
      }

      const extracted: ExtractedEntities = JSON.parse(extractionContent)
      const fallback = this.deterministicFallback(email)
      const fallbackEntities = fallback?.metadata.extractedEntities

      // Step 4: Map email type to suggested job status
      const suggestedStatus = this.mapEmailTypeToStatus(
        classification.type as EmailType
      )

      return {
        type: classification.type as EmailType,
        confidence: classification.confidence,
        jobInfo: {
          company: extracted.company || fallbackEntities?.company || undefined,
          title: extracted.title || fallbackEntities?.title || undefined,
          location: extracted.location || fallbackEntities?.location || undefined,
        },
        suggestedStatus,
        metadata: {
          keywords: [], // Empty for AI classifier
          reasoning: classification.reasoning,
          shouldProcess: true,
          // Store full extracted entities for use in Activity metadata
          extractedEntities: {
            ...extracted,
            company: extracted.company || fallbackEntities?.company || null,
            title: extracted.title || fallbackEntities?.title || null,
            location: extracted.location || fallbackEntities?.location || null,
          },
        },
      }
    } catch (error) {
      console.error('AI classification error:', error)
      const fallback = this.deterministicFallback(
        email,
        error instanceof Error ? error.message : 'Unknown AI classification error',
      )
      if (fallback) return fallback

      // Fallback: return OTHER type with low confidence when deterministic
      // classification also cannot identify a direct application email.
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

  private deterministicFallback(
    email: EmailMessage,
    reason?: string,
  ): ClassifiedEmail | null {
    const fallback = this.deterministic.classify(email)
    if (fallback.type === DeterministicEmailType.OTHER || fallback.confidence < 20) {
      return null
    }
    if (!fallback.jobInfo?.company || !fallback.jobInfo?.title) {
      return null
    }

    const extractedEntities: ExtractedEntities = {
      company: fallback.jobInfo?.company ?? null,
      title: fallback.jobInfo?.title ?? null,
      location: fallback.jobInfo?.location ?? null,
      nextSteps: [],
    }

    return {
      type: fallback.type as unknown as EmailType,
      confidence: fallback.confidence,
      jobInfo: fallback.jobInfo,
      suggestedStatus: fallback.suggestedStatus,
      metadata: {
        keywords: fallback.metadata.keywords,
        reasoning: reason
          ? `Deterministic fallback rescued email after AI result: ${reason}`
          : 'Deterministic fallback supplied missing email entities.',
        shouldProcess: true,
        extractedEntities,
      },
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

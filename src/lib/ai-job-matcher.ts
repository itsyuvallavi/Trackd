/**
 * AI-Powered Job Matcher
 * 
 * Replaces fuzzy string matching with AI-powered semantic matching
 * using GPT-4o-mini.
 */

import { ClassifiedEmail } from './ai-email-classifier'
import { getAIClient } from './ai/client'
import { getMatchingPrompt, JobCandidate } from './ai/prompts/matching'
import { MatchResult as AIMatchResult } from './ai/types'
import { MatchResult } from './email-classifier'

export class AIJobMatcher {
  private client = getAIClient()

  /**
   * Match a classified email to existing jobs using AI
   */
  async matchToJob(
    classified: ClassifiedEmail,
    jobs: Array<{ id: string; title: string; company: string; location?: string | null; contactEmail?: string | null }>,
    emailMessage?: { from: string; subject: string }
  ): Promise<MatchResult> {
    try {
      // If no job info extracted, return no match
      if (!classified.jobInfo || (!classified.jobInfo.company && !classified.jobInfo.title)) {
        return {
          jobId: null,
          confidence: 'none',
          reason: 'No job info extracted from email',
        }
      }

      // If no jobs exist, return no match
      if (jobs.length === 0) {
        return {
          jobId: null,
          confidence: 'none',
          reason: 'No jobs found in database',
        }
      }

      // Get extracted entities from metadata if available
      const extracted = 'extractedEntities' in classified.metadata && classified.metadata.extractedEntities
        ? classified.metadata.extractedEntities
        : {
            company: classified.jobInfo.company || null,
            title: classified.jobInfo.title || null,
            location: classified.jobInfo.location || null,
          }

      // Prepare job candidates
      const candidates: JobCandidate[] = jobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location || undefined,
        contactEmail: job.contactEmail || undefined,
      }))

      // Use AI to match
      const matchingPrompt = getMatchingPrompt(extracted, candidates)
      const response = await this.client.chatCompletion([
        {
          role: 'user',
          content: matchingPrompt,
        },
      ])

      const content = response.data.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from AI matching')
      }

      const aiMatch: AIMatchResult = JSON.parse(content)

      // Convert AI match result to MatchResult format
      if (!aiMatch.jobId || aiMatch.confidence < 70) {
        // Low confidence or no match
        if (aiMatch.alternativeMatches && aiMatch.alternativeMatches.length > 0) {
          // Ambiguous match
          return {
            jobId: null,
            confidence: 'ambiguous',
            matchedJobs: aiMatch.alternativeMatches.map(alt => ({
              id: alt.jobId,
              title: alt.title,
              company: alt.company,
            })),
            reason: aiMatch.reasoning || 'Multiple possible matches found',
          }
        }
        return {
          jobId: null,
          confidence: 'none',
          reason: aiMatch.reasoning || 'No confident match found',
        }
      }

      // High confidence match
      if (aiMatch.confidence >= 90) {
        return {
          jobId: aiMatch.jobId,
          confidence: 'exact',
          reason: aiMatch.reasoning || `AI match: ${aiMatch.confidence}% confidence`,
        }
      } else {
        return {
          jobId: aiMatch.jobId,
          confidence: 'fuzzy',
          reason: aiMatch.reasoning || `AI match: ${aiMatch.confidence}% confidence`,
        }
      }
    } catch (error) {
      console.error('AI matching error:', error)
      // Fallback: return no match
      return {
        jobId: null,
        confidence: 'none',
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Get AI usage statistics
   */
  getStats() {
    return this.client.getStats()
  }
}


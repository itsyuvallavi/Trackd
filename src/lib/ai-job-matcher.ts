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

/**
 * Normalize a string for comparison (lowercase, trim, remove special chars, collapse spaces)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
}

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

      // SAFETY CHECK: Before calling AI, check if multiple jobs match the same company+title
      // This prevents the AI from arbitrarily picking one when there are duplicates
      if (extracted.company && extracted.title) {
        const normalizedEmailCompany = normalizeString(extracted.company)
        const normalizedEmailTitle = normalizeString(extracted.title)
        
        const exactMatches = jobs.filter(job => {
          const normalizedJobCompany = normalizeString(job.company)
          const normalizedJobTitle = normalizeString(job.title)
          return normalizedJobCompany === normalizedEmailCompany && 
                 normalizedJobTitle === normalizedEmailTitle
        })
        
        // If we have multiple jobs with the exact same normalized company+title,
        // this is inherently ambiguous - don't let AI pick one arbitrarily
        if (exactMatches.length > 1) {
          return {
            jobId: null,
            confidence: 'ambiguous',
            matchedJobs: exactMatches.map(job => ({
              id: job.id,
              title: job.title,
              company: job.company,
            })),
            reason: `Multiple jobs found with same company "${extracted.company}" and title "${extracted.title}" - requires user selection`,
          }
        }
        
        // If we have exactly one exact match, we can be confident without AI
        if (exactMatches.length === 1) {
          return {
            jobId: exactMatches[0].id,
            confidence: 'exact',
            reason: `Exact match: company "${extracted.company}" + title "${extracted.title}"`,
          }
        }
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

      // If AI explicitly indicates ambiguous matches, always treat as ambiguous
      if (aiMatch.requiresUserInput === true || 
          (aiMatch.alternativeMatches && aiMatch.alternativeMatches.length > 0)) {
        const allMatches = aiMatch.alternativeMatches || []
        if (aiMatch.jobId) {
          // Include the primary match in the list
          const primaryJob = jobs.find(job => job.id === aiMatch.jobId)
          if (primaryJob && !allMatches.some(m => m.jobId === aiMatch.jobId)) {
            allMatches.unshift({
              jobId: aiMatch.jobId,
              confidence: aiMatch.confidence,
              title: primaryJob.title,
              company: primaryJob.company,
            })
          }
        }
        return {
          jobId: null,
          confidence: 'ambiguous',
          matchedJobs: allMatches.map(alt => ({
            id: alt.jobId,
            title: alt.title,
            company: alt.company,
          })),
          reason: aiMatch.reasoning || 'Multiple possible matches found',
        }
      }

      // SAFETY CHECK: After AI returns a match, verify there are no duplicate jobs
      // with the same normalized (company, title) that could cause confusion
      // This is a hard safety rule that overrides AI confidence
      if (aiMatch.jobId && extracted.company && extracted.title) {
        const matchedJob = jobs.find(job => job.id === aiMatch.jobId)
        if (matchedJob) {
          const normalizedEmailCompany = normalizeString(extracted.company)
          const normalizedEmailTitle = normalizeString(extracted.title)
          const normalizedMatchedCompany = normalizeString(matchedJob.company)
          const normalizedMatchedTitle = normalizeString(matchedJob.title)
          
          // Check if the matched job has the same normalized (company, title) as the email
          if (normalizedMatchedCompany === normalizedEmailCompany && 
              normalizedMatchedTitle === normalizedEmailTitle) {
            // Now check if there are other jobs with the same normalized (company, title)
            const siblingJobs = jobs.filter(job => {
              const normalizedJobCompany = normalizeString(job.company)
              const normalizedJobTitle = normalizeString(job.title)
              return normalizedJobCompany === normalizedEmailCompany && 
                     normalizedJobTitle === normalizedEmailTitle &&
                     job.id !== aiMatch.jobId // Exclude the matched job itself
            })
            
            // If there are sibling jobs, this is ambiguous - don't auto-update
            if (siblingJobs.length > 0) {
              return {
                jobId: null,
                confidence: 'ambiguous',
                matchedJobs: [
                  matchedJob,
                  ...siblingJobs
                ].map(job => ({
                  id: job.id,
                  title: job.title,
                  company: job.company,
                })),
                reason: `AI matched job "${matchedJob.title}" at "${matchedJob.company}", but ${siblingJobs.length} other job(s) with identical company and title exist - requires user selection`,
              }
            }
          }
        }
      }

      // High confidence match (only if no ambiguity detected)
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


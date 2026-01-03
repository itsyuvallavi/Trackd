/**
 * @deprecated This file is kept for backward compatibility and fallback support.
 * Use AIClassifier and AIJobMatcher instead for production.
 * 
 * This minimal implementation provides basic fallback functionality when AI is disabled.
 */

import { EmailMessage } from './email-service'
import { JobStatus } from '@prisma/client'

/**
 * Match result with confidence level
 */
export interface MatchResult {
  jobId: string | null
  confidence: 'exact' | 'fuzzy' | 'ambiguous' | 'none'
  matchedJobs?: Array<{ id: string; title: string; company: string }>
  reason: string
}

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
    keywords: string[]
  }
}

export enum EmailType {
  APPLICATION_CONFIRMATION = 'APPLICATION_CONFIRMATION',
  INTERVIEW_INVITE = 'INTERVIEW_INVITE',
  REJECTION = 'REJECTION',
  OFFER = 'OFFER',
  FOLLOW_UP = 'FOLLOW_UP',
  OTHER = 'OTHER',
}

/**
 * @deprecated Minimal fallback classifier. Use AIClassifier for production.
 * 
 * This provides basic classification when AI is disabled, but accuracy is limited.
 * For best results, enable AI classification with ENABLE_AI_CLASSIFICATION=true
 */
export class EmailClassifier {
  /**
   * Minimal classification - returns OTHER type with low confidence
   * @deprecated Use AIClassifier.classify() instead
   */
  classify(email: EmailMessage): ClassifiedEmail {
    // Minimal fallback - just return OTHER type
    // AI classifier should be used for accurate classification
    return {
      type: EmailType.OTHER,
      confidence: 0,
      metadata: {
        keywords: [],
      },
    }
  }

  /**
   * Basic job matching using simple string comparison
   * @deprecated Use AIJobMatcher.matchToJob() instead
   */
  matchToJob(
    email: ClassifiedEmail,
    jobs: Array<{ 
      id: string
      title: string
      company: string
      url?: string | null
      contactEmail?: string | null
      contactName?: string | null
      location?: string | null
    }>,
    emailMessage?: { from: string; subject: string }
  ): MatchResult {
    if (!email.jobInfo) {
      return {
        jobId: null,
        confidence: 'none',
        reason: 'No job info extracted from email',
      }
    }

    // Basic exact match: Company + Title
    if (email.jobInfo.company && email.jobInfo.title) {
      const exactMatches = jobs.filter(job => {
        const companyMatch = job.company.toLowerCase().includes(email.jobInfo!.company!.toLowerCase()) ||
                            email.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
        const titleMatch = job.title.toLowerCase().includes(email.jobInfo!.title!.toLowerCase()) ||
                          email.jobInfo!.title!.toLowerCase().includes(job.title.toLowerCase())
        return companyMatch && titleMatch
      })

      if (exactMatches.length === 1) {
        return {
          jobId: exactMatches[0].id,
          confidence: 'exact',
          reason: `Exact match: company "${email.jobInfo.company}" + title "${email.jobInfo.title}"`,
        }
      }
    }

    // Basic company-only match
    if (email.jobInfo.company) {
      const companyMatches = jobs.filter(job => {
        return job.company.toLowerCase().includes(email.jobInfo!.company!.toLowerCase()) ||
               email.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
      })

      if (companyMatches.length === 1) {
        return {
          jobId: companyMatches[0].id,
          confidence: 'fuzzy',
          reason: `Company match only: "${email.jobInfo.company}"`,
        }
      } else if (companyMatches.length > 1) {
        return {
          jobId: null,
          confidence: 'ambiguous',
          matchedJobs: companyMatches.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company,
          })),
          reason: `Multiple jobs found for company "${email.jobInfo.company}" (${companyMatches.length} matches)`,
        }
      }
    }

    // No match
    return {
      jobId: null,
      confidence: 'none',
      reason: 'No matching job found',
    }
  }
}

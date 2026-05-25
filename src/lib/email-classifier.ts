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

const COMPANY_NOISE = new Set([
  're',
  'fw',
  'fwd',
  'thank',
  'thanks',
  'application',
  'update',
  'position',
  'job',
  'career',
  'careers',
])

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail',
  'googlemail',
  'outlook',
  'hotmail',
  'icloud',
  'yahoo',
  'greenhouse',
  'lever',
  'workable',
  'ashbyhq',
  'smartrecruiters',
  'linkedin',
  'indeed',
  'remotejobs',
  'recruitee',
  'teamtailor',
])

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeForMatch(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
}

function titleCaseDomain(value: string): string {
  return value
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function cleanCompany(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = compactWhitespace(value)
    .replace(/^[\s:,-]+|[\s:,-]+$/g, '')
    .replace(/\s*\[[^\]]+\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return undefined
  if (COMPANY_NOISE.has(cleaned.toLowerCase())) return undefined
  return cleaned
}

function cleanTitle(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = compactWhitespace(value)
    .replace(/^[\s:,-]+|[\s:,-]+$/g, '')
    .replace(/\s+(?:job|position|role|vacancy|opportunity)$/i, '')
    .trim()

  if (!cleaned || cleaned.length < 3) return undefined
  if (/^(this|the|our|your|a|an|job|position|role|opportunity|vacancy)$/i.test(cleaned)) {
    return undefined
  }
  return cleaned
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = match?.[1]
    if (value) return value
  }
  return undefined
}

/**
 * Deterministic fallback classifier used when AI classification is disabled or
 * by local diagnostic scripts. It intentionally favors recall for direct
 * application-status emails, then relies on matching/notifications downstream.
 * 
 * This provides basic classification when AI is disabled, but accuracy is limited.
 * For best results, enable AI classification with ENABLE_AI_CLASSIFICATION=true
 */
export class EmailClassifier {
  /**
   * Classify a job-application email using explicit phrase patterns.
   */
  classify(email: EmailMessage): ClassifiedEmail {
    const subject = email.subject ?? ''
    const body = email.textBody ?? ''
    const text = compactWhitespace(`${subject}\n${body}`)
    const normalized = normalizeForMatch(text)

    const scoredTypes = [
      this.scoreType(EmailType.OFFER, normalized, [
        'job offer',
        'offer letter',
        'pleased to offer',
        'extend an offer',
        'formal offer',
      ]),
      this.scoreType(EmailType.INTERVIEW_INVITE, normalized, [
        'interview invitation',
        'schedule an interview',
        'set up a call',
        'setup a call',
        'availability this week',
        'availability for a call',
        'phone screen',
        'zoom meeting',
        'meet with you',
        'chat a bit more',
        '30 minute call',
        '30-minute call',
        'next steps',
      ]),
      this.scoreType(EmailType.REJECTION, normalized, [
        'unfortunately',
        'not be moving forward',
        'not moving forward',
        'decided not to move forward',
        'will not continue',
        'not continue with you',
        'cant offer you an interview',
        'cannot offer you an interview',
        'we regret',
        'position has been filled',
        'other candidates',
        'better suited',
        'not selected',
        'cannot offer you the position',
        'not able to provide individual feedback',
      ]),
      this.scoreType(EmailType.APPLICATION_CONFIRMATION, normalized, [
        'thank you for applying',
        'thanks for applying',
        'received your application',
        'we received your application',
        'successfully submitted',
        'application successfully submitted',
        'thank you for your interest',
        'appreciate your interest',
        'received your resume',
        'submitting your application',
        'reviewing your application',
        'application is being reviewed',
      ]),
      this.scoreType(EmailType.FOLLOW_UP, normalized, [
        'application status',
        'status update',
        'following up',
        'follow up',
      ]),
    ].filter((item) => item.score > 0)

    const best = scoredTypes.sort((a, b) => b.score - a.score)[0]
    if (!best) {
      return {
        type: EmailType.OTHER,
        confidence: 0,
        jobInfo: this.extractJobInfo(email),
        metadata: {
          keywords: [],
        },
      }
    }

    const suggestedStatus = this.mapEmailTypeToStatus(best.type)

    return {
      type: best.type,
      confidence: Math.min(100, 20 + best.score * 15),
      jobInfo: this.extractJobInfo(email),
      suggestedStatus,
      metadata: {
        keywords: best.keywords,
      },
    }
  }

  private scoreType(type: EmailType, normalizedText: string, keywords: string[]) {
    const matches = keywords.filter((keyword) =>
      normalizedText.includes(normalizeForMatch(keyword))
    )
    return { type, score: matches.length, keywords: matches }
  }

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

  private extractJobInfo(email: EmailMessage): ClassifiedEmail['jobInfo'] {
    const subject = email.subject ?? ''
    const body = email.textBody ?? ''
    const text = compactWhitespace(`${subject}\n${body}`)
    const company = this.extractCompany(email, subject, body)
    const title = this.extractTitle(text)

    return {
      ...(company ? { company } : {}),
      ...(title ? { title } : {}),
    }
  }

  private extractCompany(email: EmailMessage, subject: string, body: string): string | undefined {
    const fromDomain = email.from.match(/@([^>\s]+)/)?.[1]?.split('.')[0]
    const fromDomainCompany =
      fromDomain && !GENERIC_EMAIL_DOMAINS.has(fromDomain.toLowerCase())
        ? titleCaseDomain(fromDomain)
        : undefined

    const extracted = cleanCompany(
      firstMatch(subject, [
        /thank you for your interest in\s+(.+?)(?:[.!🚀\n]| and | for |$)/i,
        /interest in\s+(.+?)(?:[.!🚀\n]| and | for |$)/i,
        /thank you for applying to\s+(.+?)(?:[.!🚀\n]| for |$)/i,
        /application at\s+(.+?)(?:[.!?\n]|$)/i,
        /your application to\s+(.+?)(?:[.!?\n]|$)/i,
        /from\s+(.+?)(?:[.!?\n]|$)/i,
        /^([^:\n]{2,80}):\s*(?:thanks|thank you|application|your application)/i,
        /^([^-\n]{2,80})\s+-\s*(?:application|thank you|thanks)/i,
      ]) ?? firstMatch(body, [
        /thank you for your interest in\s+(.+?)(?:[.!🚀\n]| and | for |$)/i,
        /interest in\s+(.+?)(?:[.!🚀\n]| and | for |$)/i,
        /thank you for applying to\s+(.+?)(?:[.!🚀\n]| for |$)/i,
        /application at\s+(.+?)(?:[.!?\n]|$)/i,
        /your application to\s+(.+?)(?:[.!?\n]|$)/i,
        /^([^:\n]{2,80}):\s*(?:thanks|thank you|application|your application)/i,
        /^([^-\n]{2,80})\s+-\s*(?:application|thank you|thanks)/i,
        /from\s+(.+?)(?:[.!?\n]|$)/i,
      ]),
    )

    return extracted ?? fromDomainCompany
  }

  private extractTitle(text: string): string | undefined {
    const rawTitle = firstMatch(text, [
      /application for (?:our |the |a |an |your )?(.+?)(?:\s+(?:at|with)\s+[^.\n]+| position| role| vacancy| opportunity| job|[.!?\n]|$)/i,
      /apply to (?:our |the |a |an )?(.+?)(?: position| role| vacancy| opportunity| job|[.!?\n]|$)/i,
      /vacancy of\s+(.+?)(?:[.!?\n]|$)/i,
      /about (?:the |our |a |an )?(.+?)(?: opportunity| position| role| vacancy| job)(?:[.!?\n]|$)/i,
      /for (?:our |the |a |an )?(.+?)(?: position| role| vacancy| job)(?:[.!?\n]|$)/i,
      /position:\s*(.+?)(?:\s+-\s+|[.!?\n]|$)/i,
      /position of\s+(.+?)(?:[.!?\n]|$)/i,
      /interested in (?:the )?(.+?)(?: position| role| vacancy| opportunity| job)(?:[.!?\n]|$)/i,
    ])

    return cleanTitle(rawTitle)
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

    if (jobs.length === 0) {
      return {
        jobId: null,
        confidence: 'none',
        reason: 'No jobs found in database',
      }
    }

    // Exact match: Company + Title
    if (email.jobInfo.company && email.jobInfo.title) {
      const exactMatches = jobs.filter((job) => {
        const companyMatch = this.companyMatches(job.company, email.jobInfo!.company!)
        const titleMatch = this.titleMatches(job.title, email.jobInfo!.title!)
        return companyMatch && titleMatch
      })

      if (exactMatches.length === 1) {
        return {
          jobId: exactMatches[0].id,
          confidence: 'exact',
          reason: `Exact match: company "${email.jobInfo.company}" + title "${email.jobInfo.title}"`,
        }
      }

      if (exactMatches.length > 1) {
        return {
          jobId: null,
          confidence: 'ambiguous',
          matchedJobs: exactMatches.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company,
          })),
          reason: `Multiple jobs found for company "${email.jobInfo.company}" and title "${email.jobInfo.title}"`,
        }
      }
    }

    // Company + sender domain can be exact when the sender is the company or a
    // stored contact address, even if the email omits a precise title.
    if (email.jobInfo.company && emailMessage?.from) {
      const companyDomainMatches = jobs.filter((job) => {
        return (
          this.companyMatches(job.company, email.jobInfo!.company!) &&
          this.senderDomainMatchesJob(emailMessage.from, job)
        )
      })

      if (companyDomainMatches.length === 1) {
        return {
          jobId: companyDomainMatches[0].id,
          confidence: 'exact',
          reason: `Exact match: company "${email.jobInfo.company}" + contact email domain`,
        }
      }
    }

    // Company + meaningful title word overlap. This catches variants like
    // "Full Stack React Developer" vs "React Developer Frontend", while keeping
    // generic titles such as "Engineer" ambiguous for multi-role companies.
    if (email.jobInfo.company && email.jobInfo.title) {
      const fuzzyMatches = jobs.filter((job) => {
        return (
          this.companyMatches(job.company, email.jobInfo!.company!) &&
          this.titleOverlap(job.title, email.jobInfo!.title!) >= 2
        )
      })

      if (fuzzyMatches.length === 1) {
        return {
          jobId: fuzzyMatches[0].id,
          confidence: 'fuzzy',
          reason: `Company match + shared title keywords: "${email.jobInfo.company}" / "${email.jobInfo.title}"`,
        }
      }

      if (fuzzyMatches.length > 1) {
        return {
          jobId: null,
          confidence: 'ambiguous',
          matchedJobs: fuzzyMatches.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company,
          })),
          reason: `Multiple title-similar jobs found for company "${email.jobInfo.company}"`,
        }
      }
    }

    // Basic company-only match
    if (email.jobInfo.company) {
      const companyMatches = jobs.filter(job => {
        return this.companyMatches(job.company, email.jobInfo!.company!)
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

  private companyMatches(jobCompany: string, emailCompany: string): boolean {
    const job = normalizeForMatch(jobCompany)
    const extracted = normalizeForMatch(emailCompany)
    return job.includes(extracted) || extracted.includes(job)
  }

  private titleMatches(jobTitle: string, emailTitle: string): boolean {
    const job = normalizeForMatch(jobTitle)
    const extracted = normalizeForMatch(emailTitle)
    return job.includes(extracted) || extracted.includes(job)
  }

  private titleOverlap(jobTitle: string, emailTitle: string): number {
    const ignore = new Set(['senior', 'junior', 'mid', 'level', 'role', 'position', 'engineer'])
    const jobWords = new Set(
      normalizeForMatch(jobTitle)
        .split(/\s+/)
        .filter((word) => word.length > 2 && !ignore.has(word)),
    )
    const emailWords = normalizeForMatch(emailTitle)
      .split(/\s+/)
      .filter((word) => word.length > 2 && !ignore.has(word))

    return emailWords.filter((word) => jobWords.has(word)).length
  }

  private senderDomainMatchesJob(
    from: string,
    job: { company: string; contactEmail?: string | null },
  ): boolean {
    const senderDomain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase()
    if (!senderDomain) return false

    const senderRoot = senderDomain.split('.')[0]
    const companyRoot = normalizeForMatch(job.company).replace(/\s+/g, '')
    if (senderRoot && companyRoot.includes(senderRoot)) return true
    if (senderRoot && senderRoot.includes(companyRoot)) return true

    if (job.contactEmail) {
      const contactDomain = job.contactEmail.match(/@([^>\s]+)/)?.[1]?.toLowerCase()
      return Boolean(contactDomain && contactDomain === senderDomain)
    }

    return false
  }
}

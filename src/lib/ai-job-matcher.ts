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

const GENERIC_SENDER_ROOTS = new Set([
  'email',
  'emails',
  'mail',
  'mailer',
  'notification',
  'notifications',
  'ashbyhq',
  'greenhouse',
  'greenhousemail',
  'greenhouse-mail',
  'lever',
  'workday',
  'myworkday',
  'homerun',
  'smartrecruiters',
  'recruitee',
  'teamtailor',
  'zohocalendar',
  'noreply',
  'no-reply',
  'reply',
  'contact',
  'support',
  'talent',
  'careers',
  'jobs',
])

function normalizeSenderHint(value: string): string {
  return normalizeString(value).replace(/\s+/g, '')
}

function senderAddressParts(from: string | undefined): { local: string; domain: string } | null {
  const match = from?.match(/<?([^<>\s@]+)@([^>\s>]+)>?/)
  if (!match) return null

  return {
    local: match[1].toLowerCase(),
    domain: match[2].toLowerCase(),
  }
}

function senderCompanyHints(from: string | undefined): string[] {
  const address = senderAddressParts(from)
  if (!address) return []

  const localRoot = address.local.split('+')[0].split(/[._-]/)[0]
  const localHint = normalizeSenderHint(localRoot)
  const domainHints = address.domain
    .split('.')
    .map(normalizeSenderHint)
    .filter((part) => part.length > 2 && !GENERIC_SENDER_ROOTS.has(part))

  return [...new Set([
    ...(localHint.length > 2 && !GENERIC_SENDER_ROOTS.has(localHint) ? [localHint] : []),
    ...domainHints,
  ])]
}

function companyTokens(value: string): string[] {
  const ignored = new Set(['group', 'gmbh', 'llc', 'ltd', 'limited', 'inc', 'sa', 'ag'])
  return normalizeString(value)
    .split(/\s+/)
    .map((token) => token.replace(/com$/, ''))
    .filter((token) => token.length > 1 && !ignored.has(token))
}

function companyMatches(left: string, right: string): boolean {
  const a = companyTokens(left)
  const b = companyTokens(right)
  if (a.length === 0 || b.length === 0) return false

  const compactA = a.join('')
  const compactB = b.join('')
  if (compactA === compactB) return true

  const hasSharedToken = a.some((token) => b.includes(token))
  if (hasSharedToken) return true

  return (
    compactA.length >= 5 &&
    compactB.length >= 5 &&
    (compactA.includes(compactB) || compactB.includes(compactA))
  )
}

function senderDomainSupportsMatch(
  from: string | undefined,
  job: { company: string; contactEmail?: string | null },
): boolean {
  const hints = senderCompanyHints(from)
  if (hints.length === 0) return false

  const companyRoot = normalizeSenderHint(job.company)
  if (hints.some((hint) => companyRoot.includes(hint) || hint.includes(companyRoot))) return true

  const contactDomain = job.contactEmail?.match(/@([^>\s]+)/)?.[1]?.toLowerCase()
  if (!contactDomain) return false

  const contactHints = senderCompanyHints(`contact@${contactDomain}`)
  return contactHints.some((hint) => hints.includes(hint))
}

function shortlistCandidates(
  extracted: { company?: string | null; title?: string | null },
  jobs: Array<{ id: string; title: string; company: string; location?: string | null; contactEmail?: string | null }>,
  emailMessage?: { from: string; subject: string },
) {
  if (extracted.company) {
    const companyMatchesOnly = jobs.filter((job) =>
      companyMatches(job.company, extracted.company!) ||
      senderDomainSupportsMatch(emailMessage?.from, job),
    )
    if (companyMatchesOnly.length > 0) return companyMatchesOnly
  }

  const senderMatches = jobs.filter((job) => senderDomainSupportsMatch(emailMessage?.from, job))
  if (senderMatches.length > 0) return senderMatches

  return jobs
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

      const candidatePool = shortlistCandidates(extracted, jobs, emailMessage)

      if (!extracted.company && candidatePool.length === jobs.length && jobs.length > 20) {
        return {
          jobId: null,
          confidence: 'none',
          reason: 'No company or sender-domain context was available; title-only matching across the full job history is unsafe.',
        }
      }

      // Prepare job candidates
      const candidates: JobCandidate[] = candidatePool.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location || undefined,
        contactEmail: job.contactEmail || undefined,
      }))

      // Use AI to match
      const matchingPrompt = getMatchingPrompt(extracted, candidates, emailMessage)
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

      const matchedJob = aiMatch.jobId ? candidatePool.find(job => job.id === aiMatch.jobId) : null
      if (aiMatch.jobId && !matchedJob) {
        return {
          jobId: null,
          confidence: 'none',
          reason: `AI returned job ${aiMatch.jobId}, but it was outside the shortlisted candidates for this email.`,
        }
      }
      if (matchedJob && extracted.company) {
        const companyAligned =
          companyMatches(matchedJob.company, extracted.company) ||
          senderDomainSupportsMatch(emailMessage?.from, matchedJob)

        if (!companyAligned) {
          return {
            jobId: null,
            confidence: 'none',
            reason: `AI matched "${matchedJob.title}" at "${matchedJob.company}", but extracted email company "${extracted.company}" does not match the job company or sender domain.`,
          }
        }
      }

      // SAFETY CHECK: After AI returns a match, verify there are no duplicate jobs
      // with the same normalized (company, title) that could cause confusion
      // This is a hard safety rule that overrides AI confidence
      if (aiMatch.jobId && extracted.company && extracted.title) {
        if (matchedJob) {
          const normalizedEmailCompany = normalizeString(extracted.company)
          const normalizedEmailTitle = normalizeString(extracted.title)
          const normalizedMatchedCompany = normalizeString(matchedJob.company)
          const normalizedMatchedTitle = normalizeString(matchedJob.title)
          
          // Check if the matched job has the same normalized (company, title) as the email
          if (normalizedMatchedCompany === normalizedEmailCompany && 
              normalizedMatchedTitle === normalizedEmailTitle) {
            // Now check if there are other jobs with the same normalized (company, title)
            const siblingJobs = candidatePool.filter(job => {
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

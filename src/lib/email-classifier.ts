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

// Keywords for different email types
const KEYWORDS = {
  APPLICATION_CONFIRMATION: [
    'application received',
    'thank you for applying',
    'submitted successfully',
    'application confirmed',
    'received your application',
    'we received your resume',
    'thanks for applying',
    'application has been received',
    'successfully submitted',
    'confirm receipt',
    'thank you for your interest',
    'thanks for your interest',
    'appreciate your interest',
    'thank you for your application',
    'your application has been submitted',
    'we have received your application',
    'confirm your application',
    'application is being reviewed',
    'reviewing your application',
    'your resume has been received',
    'cv has been received',
    'successfully applied',
    'application complete',
    'thanks for submitting',
    'thank you for submitting',
    'grateful for your interest',
    'appreciate you applying',
    'job application',
    'applying for',
    'applied for',
    'your profile',
    'your candidacy',
  ],
  INTERVIEW_INVITE: [
    'interview',
    'schedule a call',
    'would like to speak',
    'next steps',
    'phone screen',
    'zoom meeting',
    'video call',
    'meet with',
    'discuss your application',
    'talk about the role',
    'chat about',
    'would love to connect',
    'schedule a time',
    'book a call',
    'set up a call',
    'arrange a meeting',
    'invite you to',
    'pleased to invite',
    'like to invite',
    'calendar invite',
    'meeting request',
    'availability',
    'speak with you',
    'talk to you',
    'conversation with',
  ],
  REJECTION: [
    'unfortunately',
    'we regret',
    'not moving forward',
    'decided to pursue',
    'other candidates',
    'will not be proceeding',
    'unable to offer',
    'position has been filled',
    'not be moving forward',
    'not able to offer',
    'not able to advance',
    'advance you to the next round',
    'next round at this time',
    'cannot advance',
    'unable to advance',
    'on our radar for future',
    'keep you in mind',
    'not a fit at this time',
    'does not align',
    'not align with',
    'moving forward with other',
    'decided to move forward with',
    'chosen to move forward',
    'not selected',
    'were not selected',
    'will not be selected',
    'other applicants',
    'another candidate',
    'different direction',
    'pursue other',
    'not be able to',
    'unable to move',
    'will not be moving',
    'have to pass',
    'must decline',
    'not successful',
    'were unsuccessful',
    'did not meet',
    'do not meet',
    'better suited',
    'better fit',
    'more qualified',
    'future opportunities',
    'future roles',
    'future positions',
    'keep your resume',
    'keep your cv',
    'on file',
  ],
  OFFER: [
    'offer of employment',
    'we are pleased to offer',
    'congratulations',
    'extend an offer',
    'job offer',
    'offer letter',
    'pleased to extend',
    'happy to offer',
    'excited to offer',
    'delighted to offer',
    'would like to offer',
    'want to offer',
    'employment offer',
    'offer you the position',
    'offer you the role',
    'accept our offer',
    'formal offer',
    'verbal offer',
  ],
  FOLLOW_UP: [
    'checking in',
    'following up',
    'update on your application',
    'status of your application',
    'wanted to follow up',
    'just checking in',
    'any updates',
    'quick update',
    'touching base',
    'circling back',
    'wanted to update',
    'application status',
    'hear back',
    'get back to you',
  ],
}

export class EmailClassifier {
  /**
   * Classify an email and extract job-related information
   */
  classify(email: EmailMessage): ClassifiedEmail {
    const combinedText = `${email.subject} ${email.textBody}`.toLowerCase()
    const detectedKeywords: string[] = []

    // Detect email type based on keywords
    let type = EmailType.OTHER
    let confidence = 0
    let suggestedStatus: JobStatus | undefined

    // Priority order: REJECTION and OFFER should take priority over APPLICATION_CONFIRMATION
    // when both match, because they're more specific and actionable
    const typePriority: Array<keyof typeof KEYWORDS> = [
      'REJECTION',
      'OFFER',
      'INTERVIEW_INVITE',
      'APPLICATION_CONFIRMATION',
      'FOLLOW_UP',
    ]

    // Check for each email type in priority order
    for (const emailTypeKey of typePriority) {
      const keywords = KEYWORDS[emailTypeKey]
      const matchedKeywords = keywords.filter((keyword) =>
        combinedText.includes(keyword.toLowerCase())
      )

      if (matchedKeywords.length > 0) {
        // Use matched count instead of ratio for better confidence scoring
        // 1 match = 20%, 2 matches = 40%, 3+ matches = 60%+
        const matchConfidence = Math.min(matchedKeywords.length * 20, 100)
        detectedKeywords.push(...matchedKeywords)

        // If we found a higher priority type, use it (even if confidence is same or slightly lower)
        // This ensures REJECTION/OFFER take precedence over APPLICATION_CONFIRMATION
        if (matchConfidence >= confidence) {
          confidence = matchConfidence
          type = EmailType[emailTypeKey as keyof typeof EmailType]
        }
      }
    }

    // Map email type to suggested job status
    switch (type) {
      case EmailType.APPLICATION_CONFIRMATION:
        suggestedStatus = JobStatus.APPLIED
        break
      case EmailType.INTERVIEW_INVITE:
        suggestedStatus = JobStatus.INTERVIEW
        break
      case EmailType.REJECTION:
        suggestedStatus = JobStatus.REJECTED
        break
      case EmailType.OFFER:
        suggestedStatus = JobStatus.OFFER
        break
    }

    // Extract job information
    const jobInfo = this.extractJobInfo(email)

    return {
      type,
      confidence,
      jobInfo,
      suggestedStatus,
      metadata: {
        keywords: detectedKeywords,
      },
    }
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string {
    const match = email.match(/@([^>]+)/)
    return match ? match[1].trim().toLowerCase() : ''
  }

  /**
   * Common non-company words that should be filtered out
   */
  private static readonly NON_COMPANY_WORDS = new Set([
    // Email-related
    're', 'fwd', 'fw', 'reply',
    // Greetings/closings
    'thank', 'thanks', 'hello', 'hi', 'dear', 'regards',
    // Application-related
    'application', 'update', 'status', 'confirmation', 'received',
    'submitted', 'regarding', 'concerning',
    // Actions
    'interview', 'invitation', 'invite', 'schedule', 'meeting',
    'next', 'steps', 'follow', 'up', 'followup',
    // Pronouns and articles
    'you', 'your', 'our', 'the', 'us', 'we', 'me', 'my', 'i', 'they', 'them',
    // Generic
    'new', 'important', 'urgent', 'action', 'required',
    'reminder', 'notification', 'alert', 'info', 'information',
  ])

  /**
   * Check if a string looks like a company name (not a generic phrase or job title)
   */
  private isLikelyCompanyName(text: string): boolean {
    const lower = text.toLowerCase().trim()
    const words = lower.split(/\s+/)

    // Too short or too long
    if (words.length === 0 || words.length > 5) return false
    if (lower.length < 2 || lower.length > 50) return false

    // Check if ALL words are non-company words
    const nonCompanyWordCount = words.filter(w =>
      EmailClassifier.NON_COMPANY_WORDS.has(w) || w.length < 2
    ).length

    // If more than half the words are noise, reject it
    if (nonCompanyWordCount > words.length / 2) return false

    // Check for specific patterns that indicate it's NOT a company
    if (/^(thank|thanks|dear|hello|hi|your|our|the|re|fwd|fw)\s/i.test(lower)) return false
    if (/\s(update|status|application|interview|invitation|confirmation)$/i.test(lower)) return false

    // Reject if it looks like a complete job title
    // (ends with common job title words OR starts with seniority prefixes)
    if (/\b(engineer|developer|designer|analyst|architect|manager|specialist|coordinator|director|consultant|associate|assistant|administrator|technician|scientist|researcher|accountant|nurse|teacher|writer|editor|recruiter|representative|executive|officer|advisor|planner|therapist|attorney|lawyer|paralegal|pharmacist|physician|surgeon|dentist|veterinarian|chef|mechanic|electrician|plumber|carpenter|driver|pilot|agent|broker|auditor|clerk|secretary|receptionist|cashier|salesperson|marketer|producer|creator|strategist|supervisor|inspector|investigator|estimator|appraiser|adjuster|underwriter|actuary|statistician|economist|psychologist|sociologist|anthropologist|historian|librarian|curator|archivist|translator|interpreter|photographer|videographer|animator|illustrator|copywriter|journalist|reporter|anchor|broadcaster|publicist)$/i.test(lower)) return false
    // Reject if it starts with seniority prefix (with or without space after)
    if (/^(senior|junior|lead|staff|principal|mid|entry|chief|head|vice|assistant|associate|executive)(\s|$)/i.test(lower)) return false

    // Reject common false positives from email body
    if (lower === 'this time' || lower === 'all' || lower === 'candidates') return false

    return true
  }

  /**
   * Extract job information from email content
   */
  private extractJobInfo(email: EmailMessage): ClassifiedEmail['jobInfo'] {
    const jobInfo: ClassifiedEmail['jobInfo'] = {}
    const subject = email.subject
    const body = email.textBody

    // 1. Extract company name from subject line using prioritized patterns
    // Try most specific patterns first

    const companyExtractionAttempts: Array<{ pattern: RegExp; group: number; description: string }> = [
      // "Yuval, Holycode has received your resume" - Name, Company pattern
      { pattern: /^[A-Z][a-z]+,\s+([A-Z][A-Za-z0-9\s&.]+?)\s+has\s+received/i, group: 1, description: 'Name, X has received' },
      // "Thanks for applying to CoverGo" - Workable/common pattern (extract company after "to")
      { pattern: /thanks?\s+for\s+applying\s+to\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[!.]|\s*$)/i, group: 1, description: 'thanks for applying to X' },
      // "Thank you for applying to Google" - most explicit
      { pattern: /thank\s+you\s+for\s+(?:applying|your\s+application)\s+(?:to|at)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.,]|\s*$)/i, group: 1, description: 'thank you for applying to X' },
      // "for your interest in Apple" or "for your application to Apple" - but NOT followed by job title
      { pattern: /for\s+your\s+(?:interest|application)\s+(?:in|to|at)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.,]|\s*$)/i, group: 1, description: 'for your interest in X' },
      // "Update on your application to Ramp" or "An update on your application to Canonical"
      { pattern: /update\s+on\s+your\s+application\s+to\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.,]|\s*$)/i, group: 1, description: 'update on application to X' },
      // "Your application to Ramp" or "application at Ramp"
      // Don't match "application for [Job Title]" - only match "application to/at [Company]"
      { pattern: /(?:application|applied)\s+(?:to|at)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s+(?:is|has|was)|\s*[-|!.,]|\s*$)/i, group: 1, description: 'application to X' },
      // "Your Application @ TRACTIAN" - @ pattern
      { pattern: /application\s*@\s*([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.]|\s*$)/i, group: 1, description: 'application @ X' },
      // "Thank you for applying at GlobalLogic" - at Company at end
      { pattern: /applying\s+at\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.,]|\s*$)/i, group: 1, description: 'applying at X' },
      // "Have you completed your full application for React.js / Svelte Engineer - Remote Job at EnthuZiastic?" - at Company at END
      // Check this before generic "at X" pattern since it's more specific (end of string)
      { pattern: /\s+at\s+([A-Z][A-Za-z0-9\s&.]+?)[?.\s]*$/i, group: 1, description: 'at X at end' },
      // "Mid-level Product Designer (Remote, Europe) - LearnWorlds" - [Title] - [Company] at END of subject
      // This should be checked early since it's very specific (end of string with dash before it)
      { pattern: /[-–]\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3})$/i, group: 1, description: 'X at end after dash' },
      // "Application for Position at Ramp" - at Company pattern (generic, comes last)
      { pattern: /\s+at\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.,]|\s*$)/i, group: 1, description: 'at X' },
      // "Software Mind: Thanks for applying" - Company: prefix (most reliable)
      { pattern: /^([A-Z][A-Za-z0-9\s&.]+?):\s+/i, group: 1, description: 'X: prefix' },
      // "Thank you for your Application - City Storage Systems" - Application - Company
      { pattern: /application\s*[-–]\s*([A-Z][A-Za-z0-9\s&.]+?)(?:\s*$)/i, group: 1, description: 'Application - X' },
      // "Crodu - Application received" or "Crodu - recruitment" - Company - suffix
      { pattern: /^([A-Z][A-Za-z0-9\s&.]+?)\s*[-–]\s+(?:application|thank|your|we|interview|update|next|status|recruitment|job)/i, group: 1, description: 'X - job words' },
      // "Update from Phantom" - Update from X
      { pattern: /update\s+from\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.]|\s*$)/i, group: 1, description: 'update from X' },
      // "Interview - TechCo" or "Update - CompanyName" or "Interview invitation - TechCo" - prefix - Company pattern
      { pattern: /^(?:interview\s*(?:invitation)?|update|status|application|confirmation|invitation|next\s+steps?)\s*[-–]\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-|!.]|\s*$)/i, group: 1, description: 'job words - X' },
    ]

    for (const { pattern, group, description } of companyExtractionAttempts) {
      const match = subject.match(pattern)
      if (match && match[group]) {
        const candidate = match[group].trim()
        if (this.isLikelyCompanyName(candidate)) {
          jobInfo.company = candidate
          break
        }
      }
    }

    // 2. If no company in subject, try to extract from body (first 500 chars)
    if (!jobInfo.company && body) {
      const bodyStart = body.substring(0, 500)
      const bodyCompanyPatterns = [
        // "interview with Amazon" or "at Google"
        /(?:interview(?:ing)?|position|role|job)\s+(?:at|with)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s+(?:for|and|is)|[.,!]|\s*$)/i,
        // "joining Amazon" or "join the TechCo team"
        /(?:join(?:ing)?)\s+(?:the\s+)?([A-Z][A-Za-z0-9\s&.]+?)(?:\s+team|[.,!]|\s*$)/i,
        // "TechCo team" or "TechCo is"
        /([A-Z][A-Za-z0-9\s&.]+?)\s+(?:team|is\s+(?:pleased|excited|happy|delighted))/i,
      ]

      for (const pattern of bodyCompanyPatterns) {
        const match = bodyStart.match(pattern)
        if (match && match[1]) {
          const candidate = match[1].trim()
          if (this.isLikelyCompanyName(candidate)) {
            jobInfo.company = candidate
            break
          }
        }
      }
    }

    // 3. Fallback: Extract company from email domain (skip common email providers and ATS)
    if (!jobInfo.company) {
      const domain = this.extractDomain(email.from)
      const domainParts = domain.split('.')
      
      // Skip common ATS and email provider domains
      const skipDomains = new Set([
        'greenhouse', 'lever', 'workday', 'myworkday', 'icims', 'taleo',
        'smartrecruiters', 'jobvite', 'ashbyhq', 'gmail', 'yahoo', 'outlook',
        'hotmail', 'mail', 'email', 'noreply', 'no-reply', 'notifications',
        'jobs', 'careers', 'recruiting', 'talent', 'hire', 'apply',
        'feedback', 'info', 'hr', 'recruiting',
      ])

      // Try first part of domain
      let companyFromDomain = domainParts[0]
      
      // If first part is in skip list and we have multiple parts, try second part
      // e.g., "talent.oshkoshcorp.com" -> extract "oshkoshcorp"
      if (domainParts.length >= 2 && skipDomains.has(companyFromDomain.toLowerCase())) {
        companyFromDomain = domainParts[1]
      }
      
      if (companyFromDomain && companyFromDomain.length > 2 && !skipDomains.has(companyFromDomain.toLowerCase())) {
        // Remove common suffixes to get base company name
        // e.g., "oshkoshcorp" -> "oshkosh", "acmecorp" -> "acme"
        const baseName = companyFromDomain.replace(/(corp|inc|llc|ltd|co|tech|systems|solutions)$/i, '')
        // Capitalize first letter
        jobInfo.company = baseName.charAt(0).toUpperCase() + baseName.slice(1)
      }
    }

    // 4. Extract job title from subject
    // Common job title endings (profession-agnostic)
    const JOB_TITLE_SUFFIX = '(?:Engineer|Developer|Designer|Analyst|Architect|Manager|Specialist|Coordinator|Director|Consultant|Administrator|Technician|Scientist|Researcher|Accountant|Nurse|Teacher|Writer|Editor|Recruiter|Representative|Executive|Officer|Advisor|Planner|Therapist|Attorney|Lawyer|Pharmacist|Physician|Chef|Mechanic|Electrician|Driver|Agent|Broker|Auditor|Clerk|Supervisor|Inspector|Producer|Creator|Strategist)'

    const titlePatterns = [
      // "Mid-level Product Designer (Remote, Europe) - LearnWorlds" - [Title] (location) - Company
      new RegExp(`^([A-Za-z0-9\\-]+(?:\\s+[A-Za-z0-9\\-]+)*\\s+${JOB_TITLE_SUFFIX})\\s*(?:\\([^)]+\\))?\\s*[-–]\\s*[A-Za-z]+`, 'i'),
      // "Application for Senior Developer at Company" - must come first
      /application\s+for\s+(?:the\s+)?([A-Za-z0-9\s\-\/().,&]+?)(?:\s+(?:at|position|role)|\s*[-|]|\s*$)/i,
      // "Update on CompanyName [Job Title] Role" - Company + Title + Role/Position
      new RegExp(`on\\s+[A-Za-z0-9]+\\s+([A-Za-z0-9\\s\\-\\/]+?\\s*${JOB_TITLE_SUFFIX})(?:\\s+Role|\\s+Position|\\s*$)`, 'i'),
      // "Your application [Job Title] (level info)" - "application" followed by title (no "for")
      new RegExp(`\\bapplication\\s+([A-Z][A-Za-z0-9\\s\\-]+?\\s*${JOB_TITLE_SUFFIX}(?:\\s*\\([^)]+\\))?)`, 'i'),
      // "Thank you for your interest in [Job Title] (tech stack)"
      new RegExp(`interest\\s+in\\s+([A-Za-z0-9\\s\\-\\/]+?\\s*${JOB_TITLE_SUFFIX}(?:\\s*\\([^)]+\\))?)`, 'i'),
      // "An update on your application to Canonical - Web Developer" - Company - Title
      new RegExp(`application\\s+to\\s+[A-Za-z\\s]+\\s*[-–]\\s*([A-Za-z\\s]+?${JOB_TITLE_SUFFIX})`, 'i'),
      // "Interview for React Developer"
      /interview\s+(?:for|invitation\s+for)\s+(?:the\s+)?([A-Za-z0-9\s\-\/().,&]+?)(?:\s+(?:at|position|role)|\s*[-|]|\s*$)/i,
      // "Position: Full Stack Engineer"
      /(?:position|role|job):\s*([A-Za-z0-9\s\-\/().,&]+?)(?:\s*[-|]|\s*$)/i,
      // "Re: Senior Developer - Application"
      /^re:\s*([A-Za-z0-9\s\-\/().,&]+?)(?:\s*[-|]|\s*$)/i,
      // "Company: Thanks for applying to Senior Developer"
      /applying\s+(?:for|to)\s+(?:the\s+)?([A-Za-z0-9\s\-\/().,&]+?)(?:\s+position|\s+role|\s*[-|]|\s*$)/i,
    ]

    for (const pattern of titlePatterns) {
      const match = subject.match(pattern)
      if (match && match[1]) {
        const title = match[1].trim()
        // Make sure it's not just the company name or generic text
        if (
          title.length > 3 &&
          title.length < 80 &&
          !title.toLowerCase().includes('application') &&
          !title.toLowerCase().includes('interest') &&
          !title.toLowerCase().includes('thank') &&
          !title.toLowerCase().includes('update') &&
          title.toLowerCase() !== jobInfo.company?.toLowerCase()
        ) {
          jobInfo.title = title
          break
        }
      }
    }

    // 5. If no title from subject, try to extract from email body
    if (!jobInfo.title && body) {
      const bodyStart = body.substring(0, 1000)

      const bodyTitlePatterns = [
        // "application for the Wordpress & Full Stack Developer job"
        /application\s+for\s+(?:the\s+)?([A-Z][A-Za-z0-9\s\-\/().,&]+?)\s+(?:job|position|role)/i,
        // "applying to our Full Stack Engineer role"
        /(?:applying|applied)\s+(?:to|for)\s+(?:our|the)\s+([A-Z][A-Za-z0-9\s\-\/().,&]+?)\s+(?:role|position)/i,
        // "interested in the Senior Developer position"
        /interested\s+in\s+(?:the|our)\s+([A-Z][A-Za-z0-9\s\-\/().,&]+?)\s+(?:position|role)/i,
        // "Position: Senior Engineer" or "Role: Developer"
        /(?:position|role|job|opening):\s*([A-Z][A-Za-z0-9\s\-\/().,&]+?)(?:\s*[\n.,]|\s*-|\s*at|\s*$)/i,
        // "for the Senior Developer position/role/opportunity"
        /for\s+(?:the|our)\s+([A-Z][A-Za-z0-9\s\-\/().,&]+?)\s+(?:position|role|opportunity)/i,
        // "interview for the Software Engineer role"
        /interview\s+(?:for|regarding)\s+(?:the|our)\s+([A-Z][A-Za-z0-9\s\-\/().,&]+?)\s+(?:position|role)/i,
      ]

      for (const pattern of bodyTitlePatterns) {
        const match = bodyStart.match(pattern)
        if (match && match[1]) {
          const title = match[1].trim()
          // Validate it looks like a job title
          const isValid =
            title.length >= 5 &&                              // At least 5 chars
            title.length < 80 &&                              // Not too long
            title.split(' ').length >= 1 &&                   // At least 1 word
            title.split(' ').length <= 10 &&                  // Max 10 words
            title.toLowerCase() !== jobInfo.company?.toLowerCase() &&
            !title.toLowerCase().includes('thank') &&
            !title.toLowerCase().includes('application') &&
            !title.toLowerCase().includes('interest') &&
            !/^(this|that|your|our|the)\s/i.test(title) &&   // Doesn't start with pronouns
            /[A-Z]/.test(title)                               // Has at least one capital letter

          if (isValid) {
            jobInfo.title = title
            break
          }
        }
      }
    }

    return jobInfo
  }

  /**
   * Match email to existing jobs by company, title, contact info, or other criteria
   * Returns match result with confidence level
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

    const emailFrom = emailMessage?.from.toLowerCase() || ''
    const emailDomain = emailFrom.split('@')[1]?.toLowerCase() || ''

    // 1. EXACT MATCHES (Highest Priority)
    
    // Exact match: Company + Title
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

    // Exact match: Company + Contact Email
    if (email.jobInfo.company && emailDomain) {
      const contactMatches = jobs.filter(job => {
        const companyMatch = job.company.toLowerCase().includes(email.jobInfo!.company!.toLowerCase()) ||
                            email.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
        if (!job.contactEmail) return false
        const jobDomain = job.contactEmail.toLowerCase().split('@')[1]
        return companyMatch && jobDomain === emailDomain
      })

      if (contactMatches.length === 1) {
        return {
          jobId: contactMatches[0].id,
          confidence: 'exact',
          reason: `Exact match: company "${email.jobInfo.company}" + contact email domain "${emailDomain}"`,
        }
      }
    }

    // 2. FUZZY MATCHES (Medium Priority)

    // Fuzzy match: Company + Partial Title
    if (email.jobInfo.company && email.jobInfo.title) {
      const fuzzyMatches = jobs.filter(job => {
        const companyMatch = job.company.toLowerCase().includes(email.jobInfo!.company!.toLowerCase()) ||
                            email.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
        if (!companyMatch) return false
        
        // Check if title words overlap
        const emailTitleWords = email.jobInfo!.title!.toLowerCase().split(/\s+/)
        const jobTitleWords = job.title.toLowerCase().split(/\s+/)
        const commonWords = emailTitleWords.filter(word => 
          word.length > 3 && jobTitleWords.includes(word)
        )
        return commonWords.length >= 2 // At least 2 common words
      })

      if (fuzzyMatches.length === 1) {
        return {
          jobId: fuzzyMatches[0].id,
          confidence: 'fuzzy',
          reason: `Fuzzy match: company "${email.jobInfo.company}" + similar title`,
        }
      }
    }

    // Fuzzy match: Company + Domain (if job has contact email)
    if (email.jobInfo.company && emailDomain) {
      const domainMatches = jobs.filter(job => {
        const companyMatch = job.company.toLowerCase().includes(email.jobInfo!.company!.toLowerCase()) ||
                            email.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
        if (!companyMatch) return false
        if (!job.contactEmail) return false
        const jobDomain = job.contactEmail.toLowerCase().split('@')[1]
        // Check if domains are similar (e.g., mlabs.com vs mlabstalentpartners.com)
        return jobDomain.includes(emailDomain) || emailDomain.includes(jobDomain)
      })

      if (domainMatches.length === 1) {
        return {
          jobId: domainMatches[0].id,
          confidence: 'fuzzy',
          reason: `Fuzzy match: company "${email.jobInfo.company}" + similar email domain`,
        }
      }
    }

    // 3. TITLE-ONLY MATCH (when company matching failed but title matches)
    // This handles cases like React.js/Svelte where company was extracted incorrectly
    // Run this if we have a title and either no company or company matching didn't work
    if (email.jobInfo.title) {
      const normalizeTitle = (title: string) => {
        return title.toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s]/g, '')
          .trim()
      }

      const emailTitleNormalized = normalizeTitle(email.jobInfo.title)
      const titleMatches = jobs.filter(job => {
        const jobTitleNormalized = normalizeTitle(job.title)
        
        // Exact normalized match
        if (jobTitleNormalized === emailTitleNormalized) return true
        
        // Substring match
        if (jobTitleNormalized.includes(emailTitleNormalized) || emailTitleNormalized.includes(jobTitleNormalized)) {
          const lengthDiff = Math.abs(jobTitleNormalized.length - emailTitleNormalized.length)
          const shorterLength = Math.min(jobTitleNormalized.length, emailTitleNormalized.length)
          if (lengthDiff < shorterLength * 0.3) return true
        }
        
        // Word overlap (80%+ match)
        const emailWords = emailTitleNormalized.split(/\s+/).filter(w => w.length > 2)
        const jobWords = jobTitleNormalized.split(/\s+/).filter(w => w.length > 2)
        const commonWords = emailWords.filter(word => jobWords.includes(word))
        const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)
        return matchRatio >= 0.8
      })

      if (titleMatches.length === 1) {
        return {
          jobId: titleMatches[0].id,
          confidence: 'fuzzy',
          reason: `Title match: "${email.jobInfo.title}" (company "${email.jobInfo.company || 'unknown'}" did not match)`,
        }
      }
    }

    // 4. AMBIGUOUS MATCHES (Low Priority - Multiple Candidates)

    // Company only match - check if multiple jobs exist
    if (email.jobInfo.company) {
      const companyMatches = jobs.filter(job => {
        return job.company.toLowerCase().includes(email.jobInfo!.company!.toLowerCase()) ||
               email.jobInfo!.company!.toLowerCase().includes(job.company.toLowerCase())
      })

      if (companyMatches.length > 1) {
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
      } else if (companyMatches.length === 1) {
        // Single company match - use it but with lower confidence
        return {
          jobId: companyMatches[0].id,
          confidence: 'fuzzy',
          reason: `Company match only: "${email.jobInfo.company}" (no title match)`,
        }
      }
    }

    // 5. NO MATCH
    return {
      jobId: null,
      confidence: 'none',
      reason: 'No matching job found',
    }
  }
}

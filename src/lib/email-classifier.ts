import { EmailMessage } from './email-service'
import { JobStatus } from '@prisma/client'

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
    isATS: boolean
    atsProvider?: string
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

// Known ATS (Applicant Tracking System) providers
const ATS_DOMAINS: Record<string, string> = {
  'greenhouse.io': 'Greenhouse',
  'lever.co': 'Lever',
  'myworkdayjobs.com': 'Workday',
  'icims.com': 'iCIMS',
  'jobvite.com': 'Jobvite',
  'smartrecruiters.com': 'SmartRecruiters',
  'workable.com': 'Workable',
  'bamboohr.com': 'BambooHR',
  'breezy.hr': 'Breezy HR',
  'ashbyhq.com': 'Ashby',
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
    const fromDomain = this.extractDomain(email.from)
    const isATS = this.isATSEmail(fromDomain)
    const atsProvider = isATS ? ATS_DOMAINS[fromDomain] : undefined

    const combinedText = `${email.subject} ${email.textBody}`.toLowerCase()
    const detectedKeywords: string[] = []

    // Detect email type based on keywords
    let type = EmailType.OTHER
    let confidence = 0
    let suggestedStatus: JobStatus | undefined

    // Check for each email type
    for (const [emailType, keywords] of Object.entries(KEYWORDS)) {
      const matchedKeywords = keywords.filter((keyword) =>
        combinedText.includes(keyword.toLowerCase())
      )

      if (matchedKeywords.length > 0) {
        // Use matched count instead of ratio for better confidence scoring
        // 1 match = 20%, 2 matches = 40%, 3+ matches = 60%+
        const matchConfidence = Math.min(matchedKeywords.length * 20, 100)
        detectedKeywords.push(...matchedKeywords)

        if (matchConfidence > confidence) {
          confidence = matchConfidence
          type = EmailType[emailType as keyof typeof EmailType]
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
    const jobInfo = this.extractJobInfo(email, isATS)

    return {
      type,
      confidence,
      jobInfo,
      suggestedStatus,
      metadata: {
        isATS,
        atsProvider,
        keywords: detectedKeywords,
      },
    }
  }

  /**
   * Check if email is from a known ATS provider
   */
  private isATSEmail(domain: string): boolean {
    return Object.keys(ATS_DOMAINS).some((atsDomain) =>
      domain.includes(atsDomain)
    )
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string {
    const match = email.match(/@([^>]+)/)
    return match ? match[1].trim().toLowerCase() : ''
  }

  /**
   * Extract job information from email content
   */
  private extractJobInfo(
    email: EmailMessage,
    isATS: boolean
  ): ClassifiedEmail['jobInfo'] {
    const jobInfo: ClassifiedEmail['jobInfo'] = {}
    const subject = email.subject
    const body = email.textBody

    // 1. Extract company name from subject line
    // Common patterns:
    // - "Company Name: ..." (e.g., "Software Mind: Thanks for applying")
    // - "... at Company Name" (e.g., "Application for Position at Ramp")
    // - "Company Name -" (e.g., "Crodu - Application received")
    // - "Thank you for your application to Company Name"

    const companyPatterns = [
      /^([^:]+):\s*/,  // "Company Name: ..."
      /\sat\s+([A-Z][A-Za-z\s&]+?)(?:\s*[-|]|\s*$)/,  // "at Company Name"
      /^([A-Z][A-Za-z\s&]+?)\s*[-–]\s*/,  // "Company Name - ..."
      /to\s+([A-Z][A-Za-z\s&]+?)(?:\s*[-|]|\s*$)/,  // "to Company Name"
      /for\s+your\s+(?:interest|application)\s+(?:in|to|at)\s+([A-Z][A-Za-z\s&|]+?)(?:\s*[-—]|\s*$|\.)/i,  // "interest in Company Name"
      /thank\s+you\s+for\s+applying\s+(?:to|at)\s+([A-Z][A-Za-z\s&]+?)(?:\s*[-|]|\s*$)/i,  // "applying to Company Name"
    ]

    for (const pattern of companyPatterns) {
      const match = subject.match(pattern)
      if (match && match[1]) {
        const company = match[1].trim()
        // Filter out common noise words and validate
        if (
          company.length > 2 &&
          !company.toLowerCase().startsWith('re') &&
          !company.toLowerCase().startsWith('fwd') &&
          !company.toLowerCase().includes('thank') &&
          !company.toLowerCase().includes('application') &&
          !company.toLowerCase().includes('update')
        ) {
          jobInfo.company = company
          break
        }
      }
    }

    // 2. If no company in subject, try to extract from body (first 500 chars)
    if (!jobInfo.company && body) {
      const bodyStart = body.substring(0, 500)
      const bodyCompanyPatterns = [
        /(?:at|with|join)\s+([A-Z][A-Za-z\s&]+?)(?:\s+team|\s+is|\s+and|\.|\!)/,
        /([A-Z][A-Za-z\s&]+?)\s+(?:team|is hiring|recruiting)/,
      ]

      for (const pattern of bodyCompanyPatterns) {
        const match = bodyStart.match(pattern)
        if (match && match[1]) {
          const company = match[1].trim()
          if (company.length > 2 && company.split(' ').length <= 5) {
            jobInfo.company = company
            break
          }
        }
      }
    }

    // 3. Fallback: Extract company from email domain if not from ATS
    if (!jobInfo.company && !isATS) {
      const domain = this.extractDomain(email.from)
      const companyFromDomain = domain.split('.')[0]
      if (companyFromDomain && companyFromDomain.length > 2) {
        jobInfo.company =
          companyFromDomain.charAt(0).toUpperCase() + companyFromDomain.slice(1)
      }
    }

    // 4. Extract job title from subject
    const titlePatterns = [
      /application\s+for\s+(.+?)(?:\s*-|\s*at|\s*\||\s*$)/i,
      /re:\s+(.+?)(?:\s*-|\s*at|\s*\||\s*$)/i,
      /(.+?)\s*-\s*job\s+application/i,
      /position:\s*(.+?)(?:\s*-|\s*at|\s*\||\s*$)/i,
      /applying\s+for\s+(?:the\s+)?(.+?)(?:\s+position|\s+role|\s*-|\s*at|\s*$)/i,
    ]

    for (const pattern of titlePatterns) {
      const match = subject.match(pattern)
      if (match && match[1]) {
        const title = match[1].trim()
        // Make sure it's not just the company name or generic text
        if (
          title.length > 3 &&
          !title.toLowerCase().includes('application') &&
          !title.toLowerCase().includes('interest') &&
          title !== jobInfo.company
        ) {
          jobInfo.title = title
          break
        }
      }
    }

    // 5. If no title from subject, try to extract from email body
    if (!jobInfo.title && body) {
      // Look for common job title patterns in first 1000 chars
      const bodyStart = body.substring(0, 1000)

      const bodyTitlePatterns = [
        // "application for the Wordpress & Full Stack Developer job"
        /application\s+for\s+the\s+([A-Z][A-Za-z\s\-\/().,&]+?)\s+(?:job|position|role)/i,
        // "applying to our Full Stack Engineer role"
        /(?:applying|applied)\s+(?:to|for)\s+(?:our|the)\s+([A-Z][A-Za-z\s\-\/().,&]+?)\s+(?:role|position)/i,
        // "interested in the Senior Developer position"
        /interested\s+in\s+(?:the|our)\s+([A-Z][A-Za-z\s\-\/().,&]+?)\s+(?:position|role)/i,
        // "Position: Senior Engineer"
        /(?:position|role|job):\s*([A-Z][A-Za-z\s\-\/().,&]+?)(?:\s*\n|\s*-|\s*at|\s*$)/i,
        // Generic: "for the [Title] position/role/opportunity"
        /for\s+(?:the|our)\s+([A-Z][A-Za-z\s\-\/().,&]+?)\s+(?:position|role|opportunity)/i,
      ]

      for (const pattern of bodyTitlePatterns) {
        const match = bodyStart.match(pattern)
        if (match && match[1]) {
          const title = match[1].trim()
          // Validate it looks like a job title
          const isValid =
            title.length >= 5 &&                              // At least 5 chars
            title.length < 80 &&                              // Not too long
            title.split(' ').length >= 2 &&                   // At least 2 words
            title.split(' ').length <= 10 &&                  // Max 10 words
            title !== jobInfo.company &&                      // Not just company name
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
   * Match email to existing jobs by company, title, or other criteria
   */
  matchToJob(
    email: ClassifiedEmail,
    jobs: Array<{ id: string; title: string; company: string; url?: string | null }>
  ): string | null {
    if (!email.jobInfo) return null

    // Try exact match on company and title
    for (const job of jobs) {
      if (
        email.jobInfo.company &&
        job.company.toLowerCase().includes(email.jobInfo.company.toLowerCase())
      ) {
        if (
          email.jobInfo.title &&
          job.title.toLowerCase().includes(email.jobInfo.title.toLowerCase())
        ) {
          return job.id
        }
        // Match by company alone if title not found
        return job.id
      }
    }

    // Try fuzzy match on title
    if (email.jobInfo.title) {
      for (const job of jobs) {
        if (
          job.title.toLowerCase().includes(email.jobInfo.title.toLowerCase()) ||
          email.jobInfo.title.toLowerCase().includes(job.title.toLowerCase())
        ) {
          return job.id
        }
      }
    }

    return null
  }
}

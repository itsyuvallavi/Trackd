import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmailClassifier, EmailType, ClassifiedEmail } from '@/lib/email-classifier'
import { JobStatus } from '@prisma/client'
import {
  EmailSyncLogger,
  SyncPhase,
  createTestEmail,
  createTestJob,
} from '@/lib/email-sync-logger'

/**
 * Integration tests for the complete email sync flow
 *
 * These tests simulate the full sync process with various email scenarios
 * to help debug issues with job recognition and notifications.
 */

describe('Email Sync Flow - Integration Tests', () => {
  let classifier: EmailClassifier
  let logger: EmailSyncLogger

  beforeEach(() => {
    classifier = new EmailClassifier()
    logger = new EmailSyncLogger('test-user-id', false) // Disable console output in tests
  })

  /**
   * Simulates the sync flow for a set of emails against existing jobs
   */
  function simulateSyncFlow(
    emails: ReturnType<typeof createTestEmail>[],
    jobs: ReturnType<typeof createTestJob>[]
  ) {
    const results: Array<{
      email: ReturnType<typeof createTestEmail>
      classified: ClassifiedEmail
      matchResult: ReturnType<typeof classifier.matchToJob>
      action: 'updated' | 'ambiguous' | 'new_job' | 'no_match' | 'skipped'
      reason: string
    }> = []

    logger.logInit('Starting sync simulation', { emailCount: emails.length, jobCount: jobs.length })
    logger.logFetch(emails.length, new Date(Date.now() - 24 * 60 * 60 * 1000))

    for (const email of emails) {
      const classified = classifier.classify(email)

      logger.logClassification({
        emailSubject: email.subject,
        emailFrom: email.from,
        emailDate: email.date.toISOString(),
        detectedType: classified.type,
        confidence: classified.confidence,
        matchedKeywords: classified.metadata.keywords,
        extractedCompany: classified.jobInfo?.company || null,
        extractedTitle: classified.jobInfo?.title || null,
        extractedLocation: classified.jobInfo?.location || null,
      })

      // Skip if OTHER or low confidence
      if (classified.type === EmailType.OTHER) {
        logger.logClassificationSkip('other', email.subject, {
          type: classified.type,
          confidence: classified.confidence,
        })
        results.push({
          email,
          classified,
          matchResult: { jobId: null, confidence: 'none', reason: 'Skipped - OTHER type' },
          action: 'skipped',
          reason: 'Email classified as OTHER',
        })
        continue
      }

      if (classified.confidence < 20) {
        logger.logClassificationSkip('lowConfidence', email.subject, {
          type: classified.type,
          confidence: classified.confidence,
        })
        results.push({
          email,
          classified,
          matchResult: { jobId: null, confidence: 'none', reason: 'Skipped - low confidence' },
          action: 'skipped',
          reason: `Low confidence: ${classified.confidence}%`,
        })
        continue
      }

      // Extract and log job info
      logger.logExtraction(email.subject, {
        company: classified.jobInfo?.company,
        title: classified.jobInfo?.title,
        location: classified.jobInfo?.location,
      })

      // Match to existing jobs
      const matchResult = classifier.matchToJob(classified, jobs, {
        from: email.from,
        subject: email.subject,
      })

      logger.logMatching({
        emailSubject: email.subject,
        extractedCompany: classified.jobInfo?.company || null,
        extractedTitle: classified.jobInfo?.title || null,
        matchResult: matchResult.confidence,
        matchReason: matchResult.reason,
        matchedJobId: matchResult.jobId,
        matchedJobTitle: matchResult.jobId ? jobs.find(j => j.id === matchResult.jobId)?.title || null : null,
        matchedJobCompany: matchResult.jobId ? jobs.find(j => j.id === matchResult.jobId)?.company || null : null,
        candidateJobs: matchResult.matchedJobs,
        allJobsChecked: jobs.length,
      })

      // Determine action based on match result
      let action: 'updated' | 'ambiguous' | 'new_job' | 'no_match' = 'no_match'

      if (matchResult.confidence === 'exact' || matchResult.confidence === 'fuzzy') {
        action = 'updated'
        const job = jobs.find(j => j.id === matchResult.jobId)
        if (job) {
          logger.logJobUpdate(
            matchResult.jobId!,
            job.title,
            job.company,
            job.status,
            classified.suggestedStatus || JobStatus.APPLIED
          )
        }
      } else if (matchResult.confidence === 'ambiguous') {
        action = 'ambiguous'
        logger.logMatchAmbiguous(email.subject, matchResult.matchedJobs || [])
      } else if (matchResult.confidence === 'none') {
        // Check if it's a new job or insufficient info
        if (classified.jobInfo?.company && classified.jobInfo?.title) {
          action = 'new_job'
          logger.logMatchNewJobDetected(
            classified.jobInfo.company,
            classified.jobInfo.title,
            email.subject
          )
        } else {
          action = 'no_match'
          logger.logMatchNoMatch(email.subject, 'Insufficient info', {
            company: classified.jobInfo?.company,
            title: classified.jobInfo?.title,
          })
        }
      }

      results.push({
        email,
        classified,
        matchResult,
        action,
        reason: matchResult.reason,
      })
    }

    return {
      results,
      summary: logger.getSummary(),
      logs: logger.getLogs(),
    }
  }

  describe('Scenario: Application Confirmation Emails', () => {
    it('should match confirmation email to existing job', () => {
      const jobs = [
        createTestJob('job-1', 'Senior Developer', 'TechCorp', 'SAVED', 'hr@techcorp.com'),
      ]
      const emails = [
        createTestEmail(
          'Thank you for applying to TechCorp',
          'jobs@techcorp.com',
          'Thank you for your application for the Senior Developer position. We have received your application and will review it shortly.'
        ),
      ]

      const { results, summary } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.APPLICATION_CONFIRMATION)
      expect(results[0].action).toBe('updated')
      expect(results[0].matchResult.jobId).toBe('job-1')
    })

    it('should detect new job when no existing job matches', () => {
      const jobs = [
        createTestJob('job-1', 'Frontend Developer', 'OtherCo', 'APPLIED'),
      ]
      const emails = [
        createTestEmail(
          'Thank you for applying to NewCorp',
          'hr@newcorp.com',
          'We have received your application for the Backend Engineer position and will be in touch soon.'
        ),
      ]

      const { results, summary } = simulateSyncFlow(emails, jobs)

      expect(results[0].action).toBe('new_job')
      expect(results[0].classified.jobInfo?.company).toBeTruthy()
    })
  })

  describe('Scenario: Interview Invites', () => {
    it('should update job status to INTERVIEW', () => {
      const jobs = [
        createTestJob('job-1', 'React Developer', 'StartupX', 'APPLIED', 'recruiting@startupx.com'),
      ]
      const emails = [
        createTestEmail(
          'StartupX: Interview invitation for React Developer',
          'recruiting@startupx.com',
          'We would like to schedule an interview with you for the React Developer position. Please let us know your availability.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.INTERVIEW_INVITE)
      expect(results[0].classified.suggestedStatus).toBe(JobStatus.INTERVIEW)
      expect(results[0].action).toBe('updated')
    })
  })

  describe('Scenario: Rejections', () => {
    it('should update job status to REJECTED', () => {
      const jobs = [
        createTestJob('job-1', 'Software Engineer', 'BigCo', 'INTERVIEW', 'talent@bigco.com'),
      ]
      const emails = [
        createTestEmail(
          'BigCo: Update on your Software Engineer application',
          'talent@bigco.com',
          'Thank you for interviewing with us. Unfortunately, we have decided to move forward with other candidates. We will keep your resume on file for future opportunities.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.REJECTION)
      expect(results[0].classified.suggestedStatus).toBe(JobStatus.REJECTED)
      expect(results[0].action).toBe('updated')
    })
  })

  describe('Scenario: Ambiguous Matches', () => {
    it('should return ambiguous when multiple jobs at same company', () => {
      const jobs = [
        createTestJob('job-1', 'Frontend Developer', 'TechGiant', 'APPLIED'),
        createTestJob('job-2', 'Backend Developer', 'TechGiant', 'APPLIED'),
        createTestJob('job-3', 'DevOps Engineer', 'TechGiant', 'SAVED'),
      ]
      const emails = [
        createTestEmail(
          'TechGiant: Thank you for applying',
          'careers@techgiant.com',
          'We appreciate your interest in joining TechGiant. Your application is being reviewed.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].action).toBe('ambiguous')
      expect(results[0].matchResult.matchedJobs?.length).toBe(3)
    })
  })

  describe('Scenario: Edge Cases', () => {
    it('should skip non-job emails', () => {
      const jobs = [
        createTestJob('job-1', 'Developer', 'SomeCo', 'APPLIED'),
      ]
      const emails = [
        createTestEmail(
          'Weekly Newsletter',
          'newsletter@randomsite.com',
          'Check out our latest blog posts and tech news!'
        ),
      ]

      const { results, summary } = simulateSyncFlow(emails, jobs)

      expect(results[0].action).toBe('skipped')
      expect(summary.skippedReasons.otherType).toBe(1)
    })

    it('should handle emails with low confidence', () => {
      const jobs = [
        createTestJob('job-1', 'Developer', 'SomeCo', 'APPLIED'),
      ]
      const emails = [
        createTestEmail(
          'Quick update',
          'someone@company.com',
          'Just wanted to check on the status.' // Only has "status" which might give low confidence
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      // Depending on keywords, might be skipped due to low confidence
      // This tests that the flow handles it gracefully
      expect(['skipped', 'no_match', 'updated']).toContain(results[0].action)
    })

    it('should handle emails where company is extracted from domain only', () => {
      const jobs = [
        createTestJob('job-1', 'Developer', 'Acme', 'APPLIED'),
      ]
      const emails = [
        createTestEmail(
          'Your application status',
          'noreply@acme.com',
          'Thank you for applying. We are currently reviewing your application.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.APPLICATION_CONFIRMATION)
      // Should extract "Acme" from domain as fallback
      expect(['updated', 'new_job', 'no_match']).toContain(results[0].action)
    })
  })

  describe('Scenario: Real Email Patterns', () => {
    // These tests use patterns from common ATS systems

    it('should handle Greenhouse-style emails', () => {
      const jobs = [
        createTestJob('job-1', 'Software Engineer', 'Stripe', 'SAVED'),
      ]
      const emails = [
        createTestEmail(
          'Your application to Stripe',
          'noreply@greenhouse.io',
          'Thanks for applying to Stripe! Your application for Software Engineer has been received. We will review it and get back to you soon.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.APPLICATION_CONFIRMATION)
      expect(results[0].action).toBe('updated')
    })

    it('should handle Lever-style emails', () => {
      const jobs = [
        createTestJob('job-1', 'Product Manager', 'Notion', 'APPLIED'),
      ]
      const emails = [
        createTestEmail(
          'Notion - Next steps in your interview process',
          'no-reply@hire.lever.co',
          'We would love to schedule a call to discuss your application for Product Manager. Please click the link below to select a time for your interview.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.INTERVIEW_INVITE)
      expect(results[0].action).toBe('updated')
    })

    it('should handle Workday-style rejections', () => {
      const jobs = [
        createTestJob('job-1', 'Data Analyst', 'Amazon', 'INTERVIEW'),
      ]
      const emails = [
        createTestEmail(
          'Amazon: Update regarding your Data Analyst application',
          'no-reply@myworkday.com',
          'Thank you for taking the time to interview with Amazon for the Data Analyst position. After careful consideration, we have decided to pursue other candidates who more closely match our current needs. We appreciate your interest and encourage you to apply for future roles.'
        ),
      ]

      const { results } = simulateSyncFlow(emails, jobs)

      expect(results[0].classified.type).toBe(EmailType.REJECTION)
      expect(results[0].action).toBe('updated')
    })
  })
})

describe('Debug Utilities', () => {
  it('should create valid test emails', () => {
    const email = createTestEmail(
      'Test Subject',
      'sender@example.com',
      'Test body content'
    )

    expect(email.id).toBeTruthy()
    expect(email.from).toBe('sender@example.com')
    expect(email.subject).toBe('Test Subject')
    expect(email.textBody).toBe('Test body content')
    expect(email.date).toBeInstanceOf(Date)
  })

  it('should create valid test jobs', () => {
    const job = createTestJob('job-123', 'Developer', 'Company', 'APPLIED', 'hr@company.com')

    expect(job.id).toBe('job-123')
    expect(job.title).toBe('Developer')
    expect(job.company).toBe('Company')
    expect(job.status).toBe('APPLIED')
    expect(job.contactEmail).toBe('hr@company.com')
  })

  it('should produce readable summary from logger', () => {
    const logger = new EmailSyncLogger('test-user', false)

    logger.logInit('Test init')
    logger.logFetch(5, new Date())
    logger.logMatching({
      emailSubject: 'Test email',
      extractedCompany: 'Test Co',
      extractedTitle: 'Developer',
      matchResult: 'exact',
      matchReason: 'Test reason',
      matchedJobId: 'job-1',
      matchedJobTitle: 'Developer',
      matchedJobCompany: 'Test Co',
      allJobsChecked: 1,
    })

    const summary = logger.getSummary()

    expect(summary.totalEmails).toBe(5)
    expect(summary.matchResults.exact).toBe(1)
    expect(summary.errors).toHaveLength(0)
  })
})

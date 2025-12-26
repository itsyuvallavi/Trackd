import { describe, it, expect, beforeEach } from 'vitest'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import { JobStatus } from '@prisma/client'

describe('EmailClassifier', () => {
  let classifier: EmailClassifier

  beforeEach(() => {
    classifier = new EmailClassifier()
  })

  describe('classify - Email Type Detection', () => {
    describe('APPLICATION_CONFIRMATION emails', () => {
      const confirmationEmails = [
        {
          name: 'explicit confirmation',
          subject: 'Thank you for applying to Software Engineer at Acme Corp',
          body: 'We have received your application and will review it shortly.',
          expectedKeywords: ['thank you for applying', 'received your application'],
        },
        {
          name: 'submission confirmation',
          subject: 'Application successfully submitted',
          body: 'Your application for the position has been successfully submitted.',
          expectedKeywords: ['successfully submitted'],
        },
        {
          name: 'interest acknowledgment',
          subject: 'Thank you for your interest in Company XYZ',
          body: 'We appreciate your interest in joining our team.',
          expectedKeywords: ['thank you for your interest', 'appreciate your interest'],
        },
        {
          name: 'resume received',
          subject: 'We received your resume',
          body: 'Thank you for submitting your application to our company.',
          expectedKeywords: ['we received your resume', 'thank you for submitting'],
        },
        {
          name: 'application being reviewed',
          subject: 'Your application is being reviewed',
          body: 'Our team is currently reviewing your application.',
          expectedKeywords: ['reviewing your application'],
        },
      ]

      confirmationEmails.forEach(({ name, subject, body, expectedKeywords }) => {
        it(`should classify "${name}" as APPLICATION_CONFIRMATION`, () => {
          const email = createEmail(subject, body)
          const result = classifier.classify(email)

          expect(result.type).toBe(EmailType.APPLICATION_CONFIRMATION)
          expect(result.suggestedStatus).toBe(JobStatus.APPLIED)
          expect(result.confidence).toBeGreaterThanOrEqual(20)

          // Check that at least some expected keywords were found
          const foundKeywords = expectedKeywords.filter(kw =>
            result.metadata.keywords.some(k => k.includes(kw) || kw.includes(k))
          )
          expect(foundKeywords.length).toBeGreaterThan(0)
        })
      })
    })

    describe('INTERVIEW_INVITE emails', () => {
      const interviewEmails = [
        {
          name: 'explicit interview invite',
          subject: 'Interview invitation for Senior Developer position',
          body: 'We would like to schedule an interview with you.',
          expectedKeywords: ['interview'],
        },
        {
          name: 'phone screen request',
          subject: 'Next steps in your application',
          body: 'We would like to schedule a phone screen with you to discuss the role.',
          expectedKeywords: ['next steps', 'phone screen'],
        },
        {
          name: 'zoom meeting invite',
          subject: 'Zoom meeting to discuss your application',
          body: 'Please join us for a zoom meeting to talk about the role.',
          expectedKeywords: ['zoom meeting', 'talk about the role'],
        },
        {
          name: 'availability request',
          subject: 'Availability for a call',
          body: 'Please let us know your availability to schedule a time to meet.',
          expectedKeywords: ['availability', 'schedule a time'],
        },
      ]

      interviewEmails.forEach(({ name, subject, body, expectedKeywords }) => {
        it(`should classify "${name}" as INTERVIEW_INVITE`, () => {
          const email = createEmail(subject, body)
          const result = classifier.classify(email)

          expect(result.type).toBe(EmailType.INTERVIEW_INVITE)
          expect(result.suggestedStatus).toBe(JobStatus.INTERVIEW)
          expect(result.confidence).toBeGreaterThanOrEqual(20)
        })
      })
    })

    describe('REJECTION emails', () => {
      const rejectionEmails = [
        {
          name: 'explicit rejection',
          subject: 'Update on your application to Company ABC',
          body: 'Unfortunately, we will not be moving forward with your application.',
          expectedKeywords: ['unfortunately', 'not be moving forward'],
        },
        {
          name: 'position filled',
          subject: 'Thank you for applying',
          body: 'We regret to inform you that the position has been filled.',
          expectedKeywords: ['we regret', 'position has been filled'],
        },
        {
          name: 'other candidates',
          subject: 'Application status update',
          body: 'We have decided to pursue other candidates for this role.',
          expectedKeywords: ['decided to pursue', 'other candidates'],
        },
        {
          name: 'not selected',
          subject: 'Your application to Tech Co',
          body: 'After careful review, you were not selected for this position.',
          expectedKeywords: ['were not selected'],
        },
        {
          name: 'keep on file',
          subject: 'Update from Company',
          body: 'Unfortunately we cannot offer you the position, but we will keep your resume on file for future opportunities.',
          expectedKeywords: ['unfortunately', 'future opportunities', 'keep your resume', 'on file'],
        },
      ]

      rejectionEmails.forEach(({ name, subject, body }) => {
        it(`should classify "${name}" as REJECTION`, () => {
          const email = createEmail(subject, body)
          const result = classifier.classify(email)

          expect(result.type).toBe(EmailType.REJECTION)
          expect(result.suggestedStatus).toBe(JobStatus.REJECTED)
          expect(result.confidence).toBeGreaterThanOrEqual(20)
        })
      })
    })

    describe('OFFER emails', () => {
      const offerEmails = [
        {
          name: 'explicit job offer',
          subject: 'Job Offer - Senior Developer',
          body: 'We are pleased to offer you the position of Senior Developer.',
          expectedKeywords: ['job offer', 'pleased to offer'],
        },
        {
          name: 'congratulations offer',
          subject: 'Congratulations!',
          body: 'We would like to extend an offer to you for the Software Engineer role.',
          expectedKeywords: ['congratulations', 'extend an offer'],
        },
        {
          name: 'offer letter',
          subject: 'Your offer letter from Company XYZ',
          body: 'Please find attached your formal offer letter.',
          expectedKeywords: ['offer letter', 'formal offer'],
        },
      ]

      offerEmails.forEach(({ name, subject, body }) => {
        it(`should classify "${name}" as OFFER`, () => {
          const email = createEmail(subject, body)
          const result = classifier.classify(email)

          expect(result.type).toBe(EmailType.OFFER)
          expect(result.suggestedStatus).toBe(JobStatus.OFFER)
          expect(result.confidence).toBeGreaterThanOrEqual(20)
        })
      })
    })

    describe('OTHER emails (should be skipped)', () => {
      const otherEmails = [
        {
          name: 'newsletter',
          subject: 'Weekly tech newsletter',
          body: 'Here are this week\'s top tech stories.',
        },
        {
          name: 'promotional email',
          subject: 'Black Friday Sale!',
          body: 'Get 50% off all products.',
        },
        {
          name: 'random email',
          subject: 'Meeting tomorrow',
          body: 'Don\'t forget about our team meeting tomorrow.',
        },
      ]

      otherEmails.forEach(({ name, subject, body }) => {
        it(`should classify "${name}" as OTHER`, () => {
          const email = createEmail(subject, body)
          const result = classifier.classify(email)

          expect(result.type).toBe(EmailType.OTHER)
          expect(result.suggestedStatus).toBeUndefined()
        })
      })
    })

    describe('Confidence scoring', () => {
      it('should increase confidence with more keyword matches', () => {
        const lowConfidence = createEmail(
          'Your application',
          'Thank you for applying.'
        )
        const highConfidence = createEmail(
          'Application received - Thank you for applying',
          'We have received your application and thank you for your interest. Your application has been submitted successfully.'
        )

        const lowResult = classifier.classify(lowConfidence)
        const highResult = classifier.classify(highConfidence)

        expect(highResult.confidence).toBeGreaterThan(lowResult.confidence)
      })

      it('should cap confidence at 100%', () => {
        const manyKeywords = createEmail(
          'Application received successfully submitted',
          'Thank you for applying. We received your application. Thank you for your interest. Application confirmed. Your resume has been received. CV has been received. Successfully applied. Application complete.'
        )

        const result = classifier.classify(manyKeywords)
        expect(result.confidence).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('classify - Job Info Extraction', () => {
    describe('Company extraction', () => {
      const companyExtractionTests = [
        {
          name: 'Company: prefix pattern',
          subject: 'Software Mind: Thanks for applying',
          expectedCompany: 'Software Mind',
        },
        {
          name: 'at Company pattern (simple)',
          subject: 'Your application at Ramp',
          expectedCompany: 'Ramp',
        },
        {
          name: 'Company - prefix pattern',
          subject: 'Crodu - Application received',
          expectedCompany: 'Crodu',
        },
        {
          name: 'interest in Company pattern',
          subject: 'Thank you for your interest in Apple -',
          expectedCompany: 'Apple',
        },
        {
          name: 'applying to Company pattern',
          subject: 'Thank you for applying to Google',
          expectedCompany: 'Google',
        },
      ]

      companyExtractionTests.forEach(({ name, subject, expectedCompany }) => {
        it(`should extract company from "${name}"`, () => {
          const email = createEmail(subject, 'Thank you for your application.')
          const result = classifier.classify(email)

          expect(result.jobInfo?.company).toBe(expectedCompany)
        })
      })

      it('should extract company from email domain as fallback', () => {
        const email = createEmail(
          'Your application status',
          'Thank you for applying.',
          'hiring@acmecorp.com'
        )
        const result = classifier.classify(email)

        expect(result.jobInfo?.company).toBe('Acmecorp')
      })
    })

    describe('Title extraction', () => {
      const titleExtractionTests = [
        {
          name: 'application for pattern',
          subject: 'Application for Senior Developer at Company',
          expectedTitle: 'Senior Developer',
        },
        {
          name: 'position: prefix',
          subject: 'Position: Full Stack Engineer - Application received',
          expectedTitle: 'Full Stack Engineer',
        },
        {
          name: 'from body - application for the X job',
          subject: 'Thank you for applying',
          body: 'Your application for the Wordpress & Full Stack Developer job has been received.',
          expectedTitle: 'Wordpress & Full Stack Developer',
        },
        {
          name: 'from body - interested in position',
          subject: 'Application update',
          body: 'Thank you for your interested in the React.js Frontend Engineer position at our company.',
          expectedTitle: 'React.js Frontend Engineer',
        },
        // Non-tech profession tests - ensuring profession-agnostic patterns
        {
          name: 'application for marketing manager',
          subject: 'Application for Marketing Manager at Acme Corp',
          expectedTitle: 'Marketing Manager',
        },
        {
          name: 'from body - registered nurse position',
          subject: 'Thank you for applying',
          body: 'Your application for the Registered Nurse position has been received.',
          expectedTitle: 'Registered Nurse',
        },
        {
          name: 'from body - financial analyst role',
          subject: 'Application update',
          body: 'Thank you for your interested in the Senior Financial Analyst position at our company.',
          expectedTitle: 'Senior Financial Analyst',
        },
        {
          name: 'application for mechanical engineer',
          subject: 'Application for Mechanical Engineer at Boeing',
          expectedTitle: 'Mechanical Engineer',
        },
        {
          name: 'from body - sales representative role',
          subject: 'We received your application',
          body: 'Your application for the Regional Sales Representative role has been submitted.',
          expectedTitle: 'Regional Sales Representative',
        },
        {
          name: 'from body - HR coordinator position',
          subject: 'Thank you for applying to HR',
          body: 'We have received your application for the HR Coordinator position and will be in touch soon.',
          expectedTitle: 'HR Coordinator',
        },
      ]

      titleExtractionTests.forEach(({ name, subject, body, expectedTitle }) => {
        it(`should extract title from "${name}"`, () => {
          const email = createEmail(subject, body || 'Thank you for your application.')
          const result = classifier.classify(email)

          expect(result.jobInfo?.title).toBe(expectedTitle)
        })
      })
    })

    describe('Edge cases', () => {
      it('should not extract company from noise words', () => {
        const email = createEmail(
          'Re: Thank you for your application',
          'Your application has been received.'
        )
        const result = classifier.classify(email)

        // Should not extract "Re" or "Thank" as company
        if (result.jobInfo?.company) {
          expect(result.jobInfo.company.toLowerCase()).not.toBe('re')
          expect(result.jobInfo.company.toLowerCase()).not.toBe('thank')
        }
      })

      it('should handle emails with no extractable job info', () => {
        const email = createEmail(
          'Update on your status',
          'Please check our careers page for updates.'
        )
        const result = classifier.classify(email)

        // Should not throw, jobInfo might be empty or have partial data
        expect(result.jobInfo).toBeDefined()
      })
    })
  })
})

// Helper function to create test emails
function createEmail(subject: string, body: string, from = 'noreply@company.com') {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    from,
    to: 'user@example.com',
    subject,
    date: new Date(),
    textBody: body,
    htmlBody: `<p>${body}</p>`,
  }
}

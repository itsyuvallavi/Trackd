import { describe, expect, it } from 'vitest'
import { JobStatus } from '@prisma/client'
import { EmailClassifier, EmailType } from '@/lib/email-classifier'
import type { EmailMessage } from '@/lib/email-service'

function email(input: {
  subject: string
  body: string
  from?: string
}): EmailMessage {
  return {
    id: `email-${input.subject}`,
    from: input.from ?? 'recruiting@example.com',
    to: 'yuval@example.com',
    subject: input.subject,
    date: new Date('2026-05-25T10:00:00.000Z'),
    textBody: input.body,
    htmlBody: `<p>${input.body}</p>`,
  }
}

describe('EmailClassifier fallback', () => {
  it('classifies real application rejections and extracts company/title', () => {
    const classifier = new EmailClassifier()
    const cases = [
      {
        message: email({
          subject: 'Your application to Reaktor',
          body: `Hi Yuval,

Thank you so much for your interest in Reaktor and for taking the time to apply to our Full-Stack Developer (Lisbon) position.

Unfortunately, we can't offer you an interview right now. Due to the high volume of applications, we are not able to provide individual feedback to candidates.`,
        }),
        company: 'Reaktor',
        title: 'Full-Stack Developer (Lisbon)',
      },
      {
        message: email({
          subject: 'Application update from Luscii',
          from: 'recruiting@luscii.com',
          body: `Hi Yuval,

Thank you for your interest and your application. We are looking for a new colleague who lives in the Netherlands already. Because of this, we will not continue with you in our process for the vacancy of Front-end TypeScript Developer.`,
        }),
        company: 'Luscii',
        title: 'Front-end TypeScript Developer',
      },
      {
        message: email({
          subject: 'Volkswagen Group Digital Solutions application update',
          body: `Hey Yuval!

Thank you for your interest in Volkswagen Group Digital Solutions [Portugal]!

After carefully reviewing your application for our Fullstack Developer (Java+React) position, we've decided not to move forward this time as we've received other applicants who were better suited for this role.`,
        }),
        company: 'Volkswagen Group Digital Solutions',
        title: 'Fullstack Developer (Java+React)',
      },
    ]

    for (const item of cases) {
      const result = classifier.classify(item.message)

      expect(result.type).toBe(EmailType.REJECTION)
      expect(result.suggestedStatus).toBe(JobStatus.REJECTED)
      expect(result.confidence).toBeGreaterThanOrEqual(20)
      expect(result.jobInfo?.company).toBe(item.company)
      expect(result.jobInfo?.title).toBe(item.title)
    }
  })

  it('classifies recruiter call requests as interview invites', () => {
    const classifier = new EmailClassifier()
    const result = classifier.classify(email({
      subject: 'Software Engineer - Backend opportunity at Restream',
      from: 'olena@restream.io',
      body: `Hello Yuval,

Thanks for your interest in Restream! I would like to set up a call to chat a bit more about the Software Engineer - Backend opportunity.

Do you have some availability this week or so for a 30 minute call?`,
    }))

    expect(result.type).toBe(EmailType.INTERVIEW_INVITE)
    expect(result.suggestedStatus).toBe(JobStatus.INTERVIEW)
    expect(result.confidence).toBeGreaterThanOrEqual(20)
    expect(result.jobInfo?.company).toBe('Restream')
    expect(result.jobInfo?.title).toBe('Software Engineer - Backend')
  })
})

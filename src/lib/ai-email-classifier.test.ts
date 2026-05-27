import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobStatus } from '@prisma/client'
import { AIClassifier, EmailType } from '@/lib/ai-email-classifier'
import type { EmailMessage } from '@/lib/email-service'

const mocks = vi.hoisted(() => ({
  chatCompletion: vi.fn(),
  getStats: vi.fn(),
}))

vi.mock('@/lib/ai/client', () => ({
  getAIClient: () => ({
    chatCompletion: mocks.chatCompletion,
    getStats: mocks.getStats,
  }),
}))

function email(input: { subject: string; body: string; from?: string }): EmailMessage {
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

function aiJson(value: unknown) {
  return {
    data: {
      choices: [
        {
          message: {
            content: JSON.stringify(value),
          },
        },
      ],
    },
  }
}

describe('AIClassifier email review', () => {
  beforeEach(() => {
    mocks.chatCompletion.mockReset()
    mocks.getStats.mockReset()
  })

  it('classifies and extracts a direct application email in one model call', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      type: 'REJECTION',
      confidence: 95,
      reasoning: 'The message rejects a specific application.',
      shouldProcess: true,
      extractedEntities: {
        company: 'Reaktor',
        title: 'Full-Stack Developer (Lisbon)',
        location: 'Lisbon',
        interviewDate: null,
        interviewTime: null,
        nextSteps: [],
        contactName: null,
        contactEmail: null,
        salary: null,
        rejectionReason: "Can't offer an interview right now",
      },
    }))

    const classifier = new AIClassifier()
    const result = await classifier.classify(email({
      subject: 'Your application to Reaktor',
      body: `Thank you so much for your interest in Reaktor and for taking the time to apply to our Full-Stack Developer (Lisbon) position.

Unfortunately, we can't offer you an interview right now.`,
    }))

    expect(result.type).toBe(EmailType.REJECTION)
    expect(result.suggestedStatus).toBe(JobStatus.REJECTED)
    expect(result.metadata.shouldProcess).toBe(true)
    expect(result.jobInfo?.company).toBe('Reaktor')
    expect(result.jobInfo?.title).toBe('Full-Stack Developer (Lisbon)')
    expect(mocks.chatCompletion).toHaveBeenCalledTimes(1)
  })

  it('does not rescue generic job-board status survey emails', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      type: 'OTHER',
      confidence: 5,
      reasoning: 'General survey asking how an application went',
      shouldProcess: false,
      extractedEntities: {
        company: null,
        title: null,
        location: null,
        interviewDate: null,
        interviewTime: null,
        nextSteps: [],
        contactName: null,
        contactEmail: null,
        salary: null,
        rejectionReason: null,
      },
    }))

    const classifier = new AIClassifier()
    const result = await classifier.classify(email({
      subject: "How'd it go with Lemon.io?",
      from: 'emma@remotejobs.org',
      body: 'Did you get the job? Let us know how your application went.',
    }))

    expect(result.type).toBe(EmailType.OTHER)
    expect(result.metadata.shouldProcess).toBe(false)
  })

  it('does not use deterministic extraction rescue when AI omits entities', async () => {
    mocks.chatCompletion.mockResolvedValueOnce(aiJson({
      type: 'INTERVIEW_INVITE',
      confidence: 91,
      reasoning: 'Recruiter asks for a call',
      shouldProcess: true,
      extractedEntities: {
        company: null,
        title: null,
        location: null,
        interviewDate: null,
        interviewTime: null,
        nextSteps: [],
        contactName: 'Olena',
        contactEmail: null,
        salary: null,
        rejectionReason: null,
      },
    }))

    const classifier = new AIClassifier()
    const result = await classifier.classify(email({
      subject: 'Software Engineer - Backend opportunity at Restream',
      from: 'olena@restream.io',
      body: `Thanks for your interest in Restream! I would like to set up a call to chat a bit more about the Software Engineer - Backend opportunity.`,
    }))

    expect(result.type).toBe(EmailType.INTERVIEW_INVITE)
    expect(result.jobInfo?.company).toBeUndefined()
    expect(result.jobInfo?.title).toBeUndefined()
    expect(result.metadata.extractedEntities?.company).toBeNull()
    expect(result.metadata.extractedEntities?.title).toBeNull()
    expect(mocks.chatCompletion).toHaveBeenCalledTimes(1)
  })
})

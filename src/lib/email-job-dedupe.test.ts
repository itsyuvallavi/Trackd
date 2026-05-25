import { describe, expect, it } from 'vitest'
import { findExistingJobForExtractedEmail } from '@/lib/email-job-dedupe'

const jobs = [
  {
    id: 'limesurvey',
    title: 'Full Stack Developer (m/f/d)',
    company: 'LimeSurvey GmbH',
  },
  {
    id: 'vw',
    title: 'Fullstack Developer (Java+React)',
    company: 'Volkswagen Group Digital Solutions [Portugal]',
  },
]

describe('email job dedupe', () => {
  it('does not suppress new-job notifications for same-title roles at different companies', () => {
    const result = findExistingJobForExtractedEmail(
      { company: 'Nothing', title: 'Full Stack Developer' },
      jobs,
    )

    expect(result).toBeNull()
  })

  it('matches company/title variations for an existing job', () => {
    const result = findExistingJobForExtractedEmail(
      { company: 'Volkswagen Group Digital Solutions', title: 'Fullstack Developer Java React' },
      jobs,
    )

    expect(result?.id).toBe('vw')
  })

  it('falls back to title-only dedupe when the email has no company', () => {
    const result = findExistingJobForExtractedEmail(
      { title: 'Full Stack Developer' },
      jobs,
    )

    expect(result?.id).toBe('limesurvey')
  })
})

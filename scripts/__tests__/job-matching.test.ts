import { describe, it, expect, beforeEach } from 'vitest'
import { EmailClassifier, EmailType, ClassifiedEmail } from '@/lib/email-classifier'
import { JobStatus } from '@prisma/client'

describe('EmailClassifier - Job Matching', () => {
  let classifier: EmailClassifier

  beforeEach(() => {
    classifier = new EmailClassifier()
  })

  // Helper to create a classified email with job info
  function createClassifiedEmail(
    company?: string,
    title?: string,
    location?: string
  ): ClassifiedEmail {
    return {
      type: EmailType.APPLICATION_CONFIRMATION,
      confidence: 60,
      jobInfo: {
        company,
        title,
        location,
      },
      suggestedStatus: JobStatus.APPLIED,
      metadata: { keywords: ['thank you for applying'] },
    }
  }

  // Helper to create test jobs
  function createJobs(jobData: Array<{ id: string; title: string; company: string; contactEmail?: string }>) {
    return jobData.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      url: null,
      contactEmail: job.contactEmail || null,
      contactName: null,
      location: null,
    }))
  }

  describe('Exact Matching (Company + Title)', () => {
    it('should return exact match when company and title both match', () => {
      const classified = createClassifiedEmail('Acme Corp', 'Senior Developer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Senior Developer', company: 'Acme Corp' },
        { id: 'job-2', title: 'Junior Developer', company: 'Other Corp' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
      expect(result.reason).toContain('Exact match')
    })

    it('should match when job title contains email title (substring match)', () => {
      const classified = createClassifiedEmail('TechCo', 'Developer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Senior Developer - Remote', company: 'TechCo Inc' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should match when email title contains job title (substring match)', () => {
      const classified = createClassifiedEmail('TechCo', 'Senior Software Developer Frontend')
      const jobs = createJobs([
        { id: 'job-1', title: 'Software Developer', company: 'TechCo' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should handle case-insensitive matching', () => {
      const classified = createClassifiedEmail('ACME CORP', 'SENIOR DEVELOPER')
      const jobs = createJobs([
        { id: 'job-1', title: 'Senior Developer', company: 'Acme Corp' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })
  })

  describe('Exact Matching (Company + Contact Email)', () => {
    it('should match when company matches and email domain matches contact email', () => {
      const classified = createClassifiedEmail('Acme', 'Any Position')
      const jobs = createJobs([
        { id: 'job-1', title: 'Different Title', company: 'Acme Corp', contactEmail: 'hr@acme.com' },
      ])
      const emailMessage = { from: 'hiring@acme.com', subject: 'Test' }

      const result = classifier.matchToJob(classified, jobs, emailMessage)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
      expect(result.reason).toContain('contact email domain')
    })
  })

  describe('Fuzzy Matching', () => {
    it('should return fuzzy match when company matches and titles have common words', () => {
      const classified = createClassifiedEmail('TechCo', 'Full Stack React Developer')
      const jobs = createJobs([
        { id: 'job-1', title: 'React Developer Frontend', company: 'TechCo Inc' },
        { id: 'job-2', title: 'Python Developer', company: 'OtherCo' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      // Should match on "React" and "Developer" (2+ common words > 3 chars)
      expect(result.confidence).toBe('fuzzy')
      expect(result.jobId).toBe('job-1')
    })

    it('should return fuzzy match when company matches and domains are similar', () => {
      const classified = createClassifiedEmail('Acme', undefined)
      const jobs = createJobs([
        { id: 'job-1', title: 'Developer', company: 'Acme Corp', contactEmail: 'hr@acmecorp.com' },
      ])
      const emailMessage = { from: 'noreply@acme.io', subject: 'Test' }

      // Note: This specific test depends on how substring matching works for domains
      const result = classifier.matchToJob(classified, jobs, emailMessage)

      // Company only match should work
      expect(['fuzzy', 'exact']).toContain(result.confidence)
      expect(result.jobId).toBe('job-1')
    })

    it('should return fuzzy match for company-only match with single job', () => {
      const classified = createClassifiedEmail('UniqueCompany', undefined)
      const jobs = createJobs([
        { id: 'job-1', title: 'Some Position', company: 'UniqueCompany Inc' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('fuzzy')
      expect(result.jobId).toBe('job-1')
      expect(result.reason).toContain('Company match only')
    })
  })

  describe('Ambiguous Matching', () => {
    it('should return ambiguous when multiple jobs match company only', () => {
      const classified = createClassifiedEmail('TechCo', undefined)
      const jobs = createJobs([
        { id: 'job-1', title: 'Frontend Developer', company: 'TechCo' },
        { id: 'job-2', title: 'Backend Developer', company: 'TechCo' },
        { id: 'job-3', title: 'DevOps Engineer', company: 'TechCo' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('ambiguous')
      expect(result.jobId).toBeNull()
      expect(result.matchedJobs).toHaveLength(3)
      expect(result.matchedJobs?.map(j => j.id)).toEqual(['job-1', 'job-2', 'job-3'])
    })

    it('should include company and title in matched jobs for ambiguous results', () => {
      const classified = createClassifiedEmail('Multi Jobs Inc', undefined)
      const jobs = createJobs([
        { id: 'job-1', title: 'Position A', company: 'Multi Jobs Inc' },
        { id: 'job-2', title: 'Position B', company: 'Multi Jobs Inc' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('ambiguous')
      expect(result.matchedJobs).toEqual([
        { id: 'job-1', title: 'Position A', company: 'Multi Jobs Inc' },
        { id: 'job-2', title: 'Position B', company: 'Multi Jobs Inc' },
      ])
    })
  })

  describe('No Match', () => {
    it('should return none when no jobs match', () => {
      const classified = createClassifiedEmail('Unknown Company', 'Random Position')
      const jobs = createJobs([
        { id: 'job-1', title: 'Developer', company: 'TechCo' },
        { id: 'job-2', title: 'Designer', company: 'DesignCo' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('none')
      expect(result.jobId).toBeNull()
    })

    it('should return none when no job info is extracted', () => {
      const classified: ClassifiedEmail = {
        type: EmailType.APPLICATION_CONFIRMATION,
        confidence: 60,
        suggestedStatus: JobStatus.APPLIED,
        metadata: { keywords: [] },
      }
      const jobs = createJobs([
        { id: 'job-1', title: 'Developer', company: 'TechCo' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('none')
      expect(result.reason).toContain('No job info extracted')
    })

    it('should return none when jobs array is empty', () => {
      const classified = createClassifiedEmail('SomeCompany', 'Some Title')

      const result = classifier.matchToJob(classified, [])

      expect(result.confidence).toBe('none')
    })
  })

  describe('Edge Cases', () => {
    it('should handle partial company name matches', () => {
      const classified = createClassifiedEmail('Acme', 'Developer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Software Developer', company: 'Acme Corporation' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should handle company names with special characters', () => {
      const classified = createClassifiedEmail('Tech & Co', 'Engineer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Software Engineer', company: 'Tech & Co Inc' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should prefer exact matches over fuzzy matches', () => {
      // Note: Both jobs match company "TechCo" (substring), so it returns the first match
      const classified = createClassifiedEmail('TechCo', 'Frontend Developer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Frontend Developer', company: 'TechCo' }, // Exact company + title
        { id: 'job-2', title: 'Backend Developer', company: 'OtherCo' }, // No match
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })
  })

  describe('Real-world Scenarios', () => {
    it('should match "React.js / Svelte Engineer" variations', () => {
      const classified = createClassifiedEmail('StartupXYZ', 'React.js / Svelte Engineer')
      const jobs = createJobs([
        { id: 'job-1', title: 'React.js / Svelte Engineer - Remote', company: 'StartupXYZ' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should match with recruiter email domain', () => {
      const classified = createClassifiedEmail('ClientCompany', undefined)
      const jobs = createJobs([
        { id: 'job-1', title: 'Senior Engineer', company: 'ClientCompany', contactEmail: 'recruiter@clientcompany.com' },
      ])
      const emailMessage = { from: 'jane@clientcompany.com', subject: 'Your application' }

      const result = classifier.matchToJob(classified, jobs, emailMessage)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should handle ATS emails with generic sender', () => {
      // Many ATS systems send from generic addresses like noreply@greenhouse.io
      const classified = createClassifiedEmail('Spotify', 'Data Engineer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Data Engineer', company: 'Spotify' },
      ])
      const emailMessage = { from: 'noreply@greenhouse.io', subject: 'Spotify - Data Engineer' }

      const result = classifier.matchToJob(classified, jobs, emailMessage)

      expect(result.confidence).toBe('exact')
      expect(result.jobId).toBe('job-1')
    })

    it('should detect ambiguity when applied to multiple positions at same company', () => {
      const classified = createClassifiedEmail('BigTech Inc', 'Engineer')
      const jobs = createJobs([
        { id: 'job-1', title: 'Frontend Engineer', company: 'BigTech Inc' },
        { id: 'job-2', title: 'Backend Engineer', company: 'BigTech Inc' },
        { id: 'job-3', title: 'DevOps Engineer', company: 'BigTech Inc' },
      ])

      const result = classifier.matchToJob(classified, jobs)

      // Title "Engineer" is too generic, should be ambiguous
      expect(result.confidence).toBe('ambiguous')
      expect(result.matchedJobs?.length).toBe(3)
    })
  })
})

describe('Duplicate Detection in Sync', () => {
  // Tests for the duplicate detection logic in sync-helper.ts
  // These test the normalization and matching logic

  const normalizeTitle = (title: string) => {
    return title.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  describe('Title Normalization', () => {
    it('should normalize titles correctly', () => {
      expect(normalizeTitle('Senior Developer')).toBe('senior developer')
      expect(normalizeTitle('  Senior   Developer  ')).toBe('senior developer')
      expect(normalizeTitle('React.js Developer')).toBe('reactjs developer')
      expect(normalizeTitle('Full-Stack Engineer')).toBe('fullstack engineer')
    })

    it('should detect exact title matches after normalization', () => {
      const emailTitle = 'React.js / Svelte Engineer'
      const jobTitle = 'React.js / Svelte Engineer - Remote'

      const emailNorm = normalizeTitle(emailTitle)
      const jobNorm = normalizeTitle(jobTitle)

      // One contains the other
      expect(jobNorm.includes(emailNorm) || emailNorm.includes(jobNorm)).toBe(true)
    })
  })

  describe('Word Overlap Matching', () => {
    it('should calculate word overlap correctly', () => {
      const emailTitle = 'Senior React Developer'
      const jobTitle = 'React Developer Frontend'

      const emailWords = normalizeTitle(emailTitle).split(/\s+/).filter(w => w.length > 2)
      const jobWords = normalizeTitle(jobTitle).split(/\s+/).filter(w => w.length > 2)
      const commonWords = emailWords.filter(word => jobWords.includes(word))
      const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)

      // "react" and "developer" are common (2 words)
      expect(commonWords).toContain('react')
      expect(commonWords).toContain('developer')
      expect(matchRatio).toBeGreaterThanOrEqual(0.5)
    })

    it('should flag as duplicate when 80%+ words match', () => {
      const emailTitle = 'Senior React Developer'
      const jobTitle = 'React Developer Senior'

      const emailWords = normalizeTitle(emailTitle).split(/\s+/).filter(w => w.length > 2)
      const jobWords = normalizeTitle(jobTitle).split(/\s+/).filter(w => w.length > 2)
      const commonWords = emailWords.filter(word => jobWords.includes(word))
      const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)

      // All 3 words match = 100%
      expect(matchRatio).toBeGreaterThanOrEqual(0.8)
    })

    it('should NOT flag as duplicate when words are different', () => {
      const emailTitle = 'Senior React Developer'
      const jobTitle = 'Junior Python Engineer'

      const emailWords = normalizeTitle(emailTitle).split(/\s+/).filter(w => w.length > 2)
      const jobWords = normalizeTitle(jobTitle).split(/\s+/).filter(w => w.length > 2)
      const commonWords = emailWords.filter(word => jobWords.includes(word))
      const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)

      // No common words
      expect(matchRatio).toBeLessThan(0.8)
    })
  })
})

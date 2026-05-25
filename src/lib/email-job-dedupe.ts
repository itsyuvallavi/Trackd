export interface EmailJobDedupeCandidate {
  title: string
  company: string
}

export interface ExtractedEmailJobInfo {
  title?: string | null
  company?: string | null
}

export function normalizeEmailJobTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bfull[\s-]*stack\b/g, 'fullstack')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function emailCompanyMatches(jobCompany: string, extractedCompany: string): boolean {
  const job = normalizeEmailJobTitle(jobCompany).replace(/\s+/g, '')
  const extracted = normalizeEmailJobTitle(extractedCompany).replace(/\s+/g, '')
  return job.includes(extracted) || extracted.includes(job)
}

export function emailJobTitleMatches(jobTitle: string, extractedTitle: string): boolean {
  const jobTitleNormalized = normalizeEmailJobTitle(jobTitle)
  const emailTitleNormalized = normalizeEmailJobTitle(extractedTitle)

  if (!jobTitleNormalized || !emailTitleNormalized) return false

  if (jobTitleNormalized === emailTitleNormalized) {
    return true
  }

  if (
    jobTitleNormalized.includes(emailTitleNormalized) ||
    emailTitleNormalized.includes(jobTitleNormalized)
  ) {
    const lengthDiff = Math.abs(jobTitleNormalized.length - emailTitleNormalized.length)
    const shorterLength = Math.min(jobTitleNormalized.length, emailTitleNormalized.length)
    if (lengthDiff < shorterLength * 0.5) {
      return true
    }
  }

  const emailWords = emailTitleNormalized.split(/\s+/).filter((word) => word.length > 2)
  const jobWords = jobTitleNormalized.split(/\s+/).filter((word) => word.length > 2)
  const commonWords = emailWords.filter((word) => jobWords.includes(word))
  const matchRatio = commonWords.length / Math.max(emailWords.length, jobWords.length)

  return matchRatio >= 0.8
}

export function findExistingJobForExtractedEmail<T extends EmailJobDedupeCandidate>(
  extracted: ExtractedEmailJobInfo,
  jobs: T[],
): T | null {
  if (!extracted.title) return null

  return jobs.find((job) => {
    if (!emailJobTitleMatches(job.title, extracted.title!)) return false

    if (!extracted.company) {
      return true
    }

    return emailCompanyMatches(job.company, extracted.company)
  }) ?? null
}

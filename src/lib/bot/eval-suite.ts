import { buildCandidateProfileFromSources } from './candidate-profile'
import { preFilterJob } from './pre-filter'
import { buildSafeSearchProfile, normalizeSearchTermKey } from './search-profile'
import { BOT_EVAL_PERSONAS, type BotEvalGoldJob, type BotEvalPersonaFixture } from './eval-suite-fixtures'

const GENERIC_SEARCH_TOKENS = new Set([
  'a',
  'an',
  'and',
  'developer',
  'engineer',
  'for',
  'in',
  'of',
  'software',
  'the',
  'with',
])

export type BotEvalCheckResult = {
  name: string
  passed: boolean
  detail?: string
}

export type BotEvalJobResult = {
  id: string
  title: string
  company: string
  gold: BotEvalGoldJob['gold']
  preFilterRejected: boolean
  preFilterFlag: string | null
  preFilterReason: string | null
  searchTermCoverageScore: number
}

export type BotEvalPersonaResult = {
  id: string
  label: string
  passed: boolean
  source: {
    kind: string
    label: string
    resumeId: string | null
    resumeLabel: string | null
  }
  safeTerms: string[]
  expectedSafeTerms: string[]
  jobs: BotEvalJobResult[]
  checks: BotEvalCheckResult[]
}

export type BotEvalSuiteResult = {
  passed: boolean
  totals: {
    personas: number
    checks: number
    failedChecks: number
    jobs: number
  }
  personas: BotEvalPersonaResult[]
}

function normalizedTokens(value: string): string[] {
  return normalizeSearchTermKey(value)
    .split(' ')
    .filter((token) => token.length > 2 && !GENERIC_SEARCH_TOKENS.has(token))
}

function containsTermToken(text: string, token: string): boolean {
  return new RegExp(`(^|\\s)${escapeRegExp(token)}(\\s|$)`).test(text)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function scoreSearchTermCoverage(job: BotEvalGoldJob, safeTerms: string[]): number {
  const title = normalizeSearchTermKey(job.title)
  const description = normalizeSearchTermKey(job.description ?? '')
  let score = 0

  for (const term of safeTerms) {
    const normalizedTerm = normalizeSearchTermKey(term)
    if (!normalizedTerm) continue

    if (title.includes(normalizedTerm)) score += 12
    if (description.includes(normalizedTerm)) score += 4

    for (const token of normalizedTokens(term)) {
      if (containsTermToken(title, token)) score += 5
      if (containsTermToken(description, token)) score += 2
    }
  }

  return score
}

function unsafeProfileValues(persona: BotEvalPersonaFixture): string[] {
  const profile = persona.applicationProfile
  const resume = persona.resume.structuredData
  const rawText = persona.resume.rawText ?? ''
  const rawUniquePhrases =
    rawText
      .split(/[.\n]/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 24 && /\b(private|confidential|synthetic-id)\b/i.test(line)) ?? []

  return [
    profile?.applicationFullName,
    profile?.applicationEmail,
    profile?.phone,
    profile?.address,
    profile?.linkedinUrl,
    profile?.githubUrl,
    profile?.portfolioUrl,
    resume?.name,
    resume?.email,
    resume?.phone,
    resume?.location,
    resume?.linkedin,
    resume?.github,
    resume?.portfolio,
    ...rawUniquePhrases,
  ].filter((value): value is string => Boolean(value?.trim()))
}

function searchTermsLeakSensitiveData(persona: BotEvalPersonaFixture, safeTerms: string[]): string | null {
  const terms = safeTerms.join(' ')
  if (/https?:|www\.|@|\+\d{2,}|\b\d{3}[-.\s]\d{3}[-.\s]\d{3,}\b/i.test(terms)) {
    return 'safe terms contain a contact-like token'
  }

  const normalizedTerms = normalizeSearchTermKey(terms)
  for (const unsafeValue of unsafeProfileValues(persona)) {
    const normalizedUnsafe = normalizeSearchTermKey(unsafeValue)
    if (normalizedUnsafe.length < 6) continue
    if (normalizedTerms.includes(normalizedUnsafe)) {
      return `safe terms contain sensitive value "${unsafeValue}"`
    }
  }

  const longTerm = safeTerms.find((term) => term.split(/\s+/).length > 4)
  if (longTerm) return `safe term is too verbose: "${longTerm}"`

  return null
}

function runPersona(persona: BotEvalPersonaFixture): BotEvalPersonaResult {
  const candidateProfile = buildCandidateProfileFromSources({
    resumes: [persona.resume],
    applicationProfile: persona.applicationProfile,
    config: persona.config,
    jobTitle: persona.config.keywords[0] ?? persona.label,
  })
  const safeSearchProfile = buildSafeSearchProfile({
    config: persona.config,
    candidateProfile,
  })
  const jobs = persona.jobs.map((job): BotEvalJobResult => {
    const preFilter = preFilterJob(job, persona.config)
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      gold: job.gold,
      preFilterRejected: preFilter.rejected,
      preFilterFlag: preFilter.rejected ? preFilter.flag : null,
      preFilterReason: preFilter.rejected ? preFilter.reason : null,
      searchTermCoverageScore: scoreSearchTermCoverage(job, safeSearchProfile.terms),
    }
  })

  const acceptedJobs = jobs.filter((job) => !job.preFilterRejected)
  const rankedAcceptedJobs = [...acceptedJobs].sort(
    (a, b) => b.searchTermCoverageScore - a.searchTermCoverageScore
  )
  const bestAcceptedJob = rankedAcceptedJobs[0]
  const leak = searchTermsLeakSensitiveData(persona, safeSearchProfile.terms)

  const checks: BotEvalCheckResult[] = [
    {
      name: 'profile_source_is_parsed_resume',
      passed: candidateProfile.source.kind === 'parsed_resume',
      detail: `source=${candidateProfile.source.kind}`,
    },
    {
      name: 'resume_source_has_expected_resume_id',
      passed: candidateProfile.source.resumeId === persona.resume.id,
      detail: `resumeId=${candidateProfile.source.resumeId ?? 'none'}`,
    },
    {
      name: 'expected_safe_terms_present',
      passed: persona.expectedSafeTerms.every((term) => safeSearchProfile.terms.includes(term)),
      detail: `terms=${safeSearchProfile.terms.join(', ')}`,
    },
    {
      name: 'settings_do_not_replace_resume_evidence',
      passed: safeSearchProfile.derivedFromResume,
      detail: `derivedFromResume=${safeSearchProfile.derivedFromResume}`,
    },
    {
      name: 'no_sensitive_search_term_leakage',
      passed: leak == null,
      detail: leak ?? 'no leakage detected',
    },
    {
      name: 'hard_filter_jobs_are_rejected',
      passed: jobs
        .filter((job) => job.gold === 'hard_filter')
        .every((job) => job.preFilterRejected && job.preFilterFlag === 'wrong_location'),
      detail: jobs
        .filter((job) => job.gold === 'hard_filter')
        .map((job) => `${job.id}:${job.preFilterFlag ?? 'accepted'}`)
        .join(', '),
    },
    {
      name: 'good_jobs_survive_prefilter',
      passed: jobs.filter((job) => job.gold === 'good').every((job) => !job.preFilterRejected),
      detail: jobs
        .filter((job) => job.gold === 'good')
        .map((job) => `${job.id}:${job.preFilterRejected ? job.preFilterFlag : 'accepted'}`)
        .join(', '),
    },
    {
      name: 'best_ranked_accepted_job_is_good',
      passed: bestAcceptedJob?.gold === 'good',
      detail: bestAcceptedJob
        ? `${bestAcceptedJob.id}:${bestAcceptedJob.gold}:${bestAcceptedJob.searchTermCoverageScore}`
        : 'no accepted jobs',
    },
  ]

  return {
    id: persona.id,
    label: persona.label,
    passed: checks.every((check) => check.passed),
    source: {
      kind: candidateProfile.source.kind,
      label: candidateProfile.source.label,
      resumeId: candidateProfile.source.resumeId,
      resumeLabel: candidateProfile.source.resumeLabel,
    },
    safeTerms: safeSearchProfile.terms,
    expectedSafeTerms: persona.expectedSafeTerms,
    jobs,
    checks,
  }
}

export function runDeterministicBotEvalSuite(
  personas: BotEvalPersonaFixture[] = BOT_EVAL_PERSONAS
): BotEvalSuiteResult {
  const results = personas.map(runPersona)
  const checks = results.flatMap((persona) => persona.checks)

  return {
    passed: checks.every((check) => check.passed),
    totals: {
      personas: results.length,
      checks: checks.length,
      failedChecks: checks.filter((check) => !check.passed).length,
      jobs: results.reduce((total, persona) => total + persona.jobs.length, 0),
    },
    personas: results,
  }
}

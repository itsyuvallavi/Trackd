/**
 * AI job evaluator.
 * Scores a job 0-100 based on the user's BotConfig and — when available —
 * the resume that best matches the job title.
 */

import { getAIClient } from '@/lib/ai/client'
import type { LanguageMismatchClampMeta } from './language-mismatch-clamp'
import {
  applyLanguageMismatchClamp,
  normalizeSpokenLanguageAllowlist,
} from './language-mismatch-clamp'
import type { StackMismatchClampMeta } from './stack-mismatch-clamp'
import { applyStackMismatchClamp } from './stack-mismatch-clamp'
import type { GeoMismatchClampMeta } from './geo-mismatch-clamp'
import { applyGeoMismatchClamp } from './geo-mismatch-clamp'
import type { SeniorityClampMeta } from './seniority-clamp'
import { applySeniorityClamp } from './seniority-clamp'
import { buildSmartJdExcerpt, type JdFacts } from './jd-excerpt'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult, JobEvaluation } from './types'
import type { ResumeStructuredData } from './resume/types'
import { preFilterJob } from './pre-filter'
import {
  loadCandidateProfileForEvaluation,
  resumeString,
  resumeStringArray,
  type CandidateProfileSourceMetadata,
  type CandidateProfile,
} from './candidate-profile'
import type { CandidateProfileSourceKind } from './profile-source-labels'
import { profileSourceLabel } from './profile-source-labels'

const EVALUATOR_MODEL = 'gpt-5-mini'

const EVALUATOR_SYSTEM_PROMPT = `You score job listings for a specific candidate. Be strict, but do not turn user preferences into absolute rules unless the job clearly conflicts with them. The user manually reviews every job you save.

Your ONE job: assess whether the job description's required skills and experience match the candidate's resume and stated keywords. Location hard rules have already been checked. Seniority preference is advisory and should be treated as a soft fit signal.

Rules:
1. Score primarily on SKILL and EXPERIENCE FIT. Use seniority only as a soft adjustment, not an automatic rejection.
2. If the description mandates a primary technology ecosystem the candidate's resume does not mention (e.g. N+ years of a specific language/framework), score below 45 unless it is marked optional / "nice to have".
3. If the description mandates a spoken language NOT in the candidate's language list, it is a significant negative.
4. Do not inflate the score just because the job title matches keywords — the description must substantively align when text exists.
5. If the description is empty or under ~80 characters: you have almost no evidence of stack fit — cap the score at 55 even when the title matches (title-only is not a "Good" match). Below 50 when the title clearly signals a wrong primary stack (e.g. "PHP Developer" when the resume only shows React/TS).
6. Never penalise on location. Location is handled elsewhere.

Your "reasoning" MUST cite at least one concrete phrase from the description, title, or company. If you cannot cite one, cap the score at 40.`

/** Structured record of what was sent to the model (for BotRunListing.scoringInputs). */
export type ScoringInputsSnapshot = {
  model: string
  minScoreThreshold: number
  userPreferences: {
    keywords: string[]
    locations: string[]
    remoteOnly: boolean
    experienceLevel: string | null
    salaryMin: number | null
    excludeCompanies: string[]
    excludeKeywords: string[]
    spokenLanguages: string[]
  }
  resumeUsed: {
    resumeId: string | null
    label: string | null
    selection: CandidateProfileSourceKind
    sourceKind: CandidateProfileSourceKind
    sourceLabel: string
    skillsSentToPrompt: string[]
    summaryIncluded: boolean
    experienceRolesInPrompt: number
    educationRowsInPrompt: number
    applicationIdentitySupplemented: boolean
    settingsDerivedSignalsUsed: boolean
    settingsSignals: string[]
    limitations: string[]
  }
  profileSource: CandidateProfileSourceMetadata
  /** Mirrors the JOB LISTING block in the evaluator prompt (description truncated same as prompt). */
  jobBlockSentToModel: {
    title: string
    company: string
    location: string
    remote: string
    salaryLine: string
    jobType: string
    descriptionCharCount: number
    descriptionPreview: string
  }
  /** When deterministic rules lower the score because required stack ≠ resume (see stack-mismatch-clamp). */
  stackMismatchClamp?: StackMismatchClampMeta
  /** When JD mandates spoken languages outside the user's BotConfig list (see language-mismatch-clamp). */
  languageMismatchClamp?: LanguageMismatchClampMeta
  /** When JD mandates a location / visa / clearance that conflicts with the user's remote preference. */
  geoMismatchClamp?: GeoMismatchClampMeta
  /** When JD's required seniority conflicts with the user's experienceLevel setting. */
  seniorityClamp?: SeniorityClampMeta
  /** Structured facts extracted from the FULL JD (audit + UI). */
  jdFacts?: JdFacts
}

export type EvaluateJobResult = {
  evaluation: JobEvaluation
  scoringInputs: ScoringInputsSnapshot
}

function buildEvalPrompt(
  job: SearchJobResult,
  config: BotConfig,
  resume: ResumeStructuredData | null,
  profileSource: CandidateProfileSourceMetadata
): string {
  const userLocations = config.locations.filter(Boolean)

  // Build a human-readable location line. Expand "Europe" and "EU" inline so the
  // LLM sees the specific country names and cannot string-match against "Italy" or
  // "Netherlands" and conclude they are outside the user's list.
  let locationDisplay: string
  if (userLocations.length === 0) {
    locationDisplay = 'Any'
  } else {
    const expandedParts = userLocations.map((loc) => {
      const lower = loc.toLowerCase().trim()
      if (lower === 'europe' || lower === 'emea' || lower === 'remote europe' || lower === 'remote emea') {
        return (
          loc +
          ' (= remote-first hiring across Europe unless the JD requires on-site only in a city you listed in Target locations, e.g. Lisbon or Porto. ' +
          'Geographic scope includes EU/EEA, UK, Switzerland, and other European countries.)'
        )
      }
      if (lower === 'eu') {
        return (
          'EU (= all EU member states: Germany, France, Spain, Italy, Netherlands, Belgium, ' +
          'Ireland, Sweden, Denmark, Finland, Poland, Austria, Czechia, Romania, Hungary, ' +
          'Greece, Bulgaria, Croatia, Slovenia, Slovakia, Estonia, Latvia, Lithuania, ' +
          'Luxembourg, Malta, Cyprus, Portugal)'
        )
      }
      return loc
    })
    locationDisplay = expandedParts.join(', ')
  }

  const prefs = [
    `Target roles/keywords: ${config.keywords.join(', ') || '(none set)'}`,
    `Target locations (authoritative — if empty the user accepts anywhere):\n  ${locationDisplay}`,
    `Remote only: ${config.remoteOnly ? 'Yes' : 'No'}`,
    config.experienceLevel
      ? `Experience level preference: ${config.experienceLevel}`
      : `Experience level preference: Any`,
    config.salaryMin ? `Minimum salary: $${config.salaryMin.toLocaleString()}/year` : null,
    config.excludeCompanies.length > 0 ? `Excluded companies: ${config.excludeCompanies.join(', ')}` : null,
    config.excludeKeywords.length > 0 ? `Excluded description keywords: ${config.excludeKeywords.join(', ')}` : null,
    config.spokenLanguages?.length
      ? `Languages the candidate speaks (postings that *require* other spoken languages as mandatory are a poor fit): ${config.spokenLanguages.join(', ')}`
      : `Spoken languages: (none set)`,
  ]
    .filter(Boolean)
    .join('\n')

  const profileSourceNotes = [
    `Profile source: ${profileSource.label}`,
    profileSource.resumeId
      ? `Resume used: ${profileSource.resumeLabel || 'Uploaded resume'} (${profileSource.resumeId})`
      : null,
    profileSource.applicationIdentitySupplemented
      ? 'Application Identity supplements contact, location, and work authorization fields only.'
      : null,
    profileSource.settingsDerivedSignalsUsed
      ? 'Settings-derived role/stack signals are weak fallback hints because no usable Job Search resume content exists; do not treat them as verified resume evidence.'
      : null,
    profileSource.limitations.length > 0
      ? `Limitations: ${profileSource.limitations.join(' ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const resumeSection = resume
    ? `
CANDIDATE RESUME:
${profileSourceNotes}
Name: ${resumeString(resume.name, 'Not listed')}
Skills: ${resumeStringArray(resume.skills).slice(0, 30).join(', ')}
${resumeString(resume.summary) ? `Summary: ${resumeString(resume.summary)}` : ''}
Experience:
${(Array.isArray(resume.experience) ? resume.experience : [])
  .slice(0, 4)
  .map((e) => {
    const title = resumeString(e?.title, 'Role')
    const company = resumeString(e?.company, 'Company')
    const startDate = resumeString(e?.startDate, '?')
    const endDate = resumeString(e?.endDate, '?')
    const description = resumeString(e?.description).slice(0, 200)
    return `  - ${title} at ${company} (${startDate}–${endDate}): ${description}`
  })
  .join('\n')}
Education:
${(Array.isArray(resume.education) ? resume.education : [])
  .map((e) => {
    const degree = resumeString(e?.degree, 'Degree')
    const field = resumeString(e?.field, 'N/A')
    const institution = resumeString(e?.institution, 'Institution')
    return `  - ${degree} in ${field} from ${institution}`
  })
  .join('\n')}
`
    : `\nNo resume uploaded — evaluate based on preferences only.\n${profileSourceNotes}\n`

  const jobInfo = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location || 'Not specified'}`,
    `Remote: ${job.is_remote ? 'Yes' : job.is_remote === false ? 'No' : 'Not specified'}`,
    job.salary_min || job.salary_max
      ? `Salary: ${job.salary_currency || 'USD'} ${job.salary_min?.toLocaleString() ?? '?'}–${job.salary_max?.toLocaleString() ?? '?'}`
      : 'Salary: Not listed',
    `Job type: ${job.job_type || 'Not specified'}`,
  ].join('\n')

  const minScore = config.minScore
  const jd = buildSmartJdExcerpt(job.description)

  return `You are evaluating job listings for a job seeker. Score this job 0-100 and decide if they should apply.

Treat the USER PREFERENCES block below as the source of truth about what the user wants. Do not invent preferences (country, continent, stack) that aren't stated there.

USER PREFERENCES:
${prefs}
${resumeSection}
SKILL FIT (your only job):
- If the posting mandates a primary ecosystem (e.g. N+ years of a specific language/framework) the candidate resume does not mention, score below 45 unless the posting clearly marks it optional / "nice to have".
- Do not inflate the score because the title matches the user's keywords when the core bullets demand a different stack.
- Language requirements labeled mandatory for languages NOT in the candidate's spoken-language list are a major negative. If the user listed no spoken languages, do not penalise on language.
- Do NOT flag or score-down on location — location hard rules are checked in code before you are called.
- Seniority preference is advisory. If a role is senior/lead or junior/graduate relative to the user's preference, mention it as a soft risk only when it materially affects fit.

JOB LISTING:
${jobInfo}

${jd.excerpt}

Respond with ONLY a JSON object:
{
  "score": <0-100 based on SKILL FIT only>,
  "reasoning": "<2-3 sentences about skill/experience match. MUST quote at least one concrete phrase from the description or title. If you cannot quote one, cap at 40.>",
  "shouldApply": <true only if score >= ${minScore}>,
  "flags": ["<relevant flags>"],
  "resumeMatch": "<which specific skills/experience from the resume are most relevant, or 'no resume' if none>"
}

Score guide: 80-100 strong skill match, 60-79 reasonable match, 40-59 partial/uncertain, 0-39 wrong primary stack.
Flags: good_match, salary_too_low, stack_mismatch, missing_required_language, remote_friendly, requires_visa, contract_only, career_change, underqualified, overqualified.
Do NOT use wrong_location — location is already handled by code before this call.`
}

function buildScoringInputsSnapshot(
  job: SearchJobResult,
  config: BotConfig,
  resume: ResumeStructuredData | null,
  profileSource: CandidateProfileSourceMetadata
): ScoringInputsSnapshot {
  const jd = buildSmartJdExcerpt(job.description)
  const desc = jd.excerpt
  return {
    model: EVALUATOR_MODEL,
    minScoreThreshold: Math.max(0, Math.min(100, config.minScore)),
    userPreferences: {
      keywords: [...config.keywords],
      locations: [...config.locations],
      remoteOnly: config.remoteOnly,
      experienceLevel: config.experienceLevel ?? null,
      salaryMin: config.salaryMin ?? null,
      excludeCompanies: [...config.excludeCompanies],
      excludeKeywords: [...config.excludeKeywords],
      spokenLanguages: [...(config.spokenLanguages ?? [])],
    },
    resumeUsed: {
      resumeId: profileSource.resumeId,
      label: profileSource.resumeLabel,
      selection: profileSource.kind,
      sourceKind: profileSource.kind,
      sourceLabel: profileSource.label,
      skillsSentToPrompt: resume ? resumeStringArray(resume.skills).slice(0, 30) : [],
      summaryIncluded: !!resume?.summary,
      experienceRolesInPrompt: resume
        ? Math.min(4, Array.isArray(resume.experience) ? resume.experience.length : 0)
        : 0,
      educationRowsInPrompt: resume && Array.isArray(resume.education) ? resume.education.length : 0,
      applicationIdentitySupplemented: profileSource.applicationIdentitySupplemented,
      settingsDerivedSignalsUsed: profileSource.settingsDerivedSignalsUsed,
      settingsSignals: profileSource.settingsSignals,
      limitations: profileSource.limitations,
    },
    profileSource,
    jobBlockSentToModel: {
      title: job.title,
      company: job.company,
      location: job.location || 'Not specified',
      remote: job.is_remote ? 'Yes' : job.is_remote === false ? 'No' : 'Not specified',
      salaryLine:
        job.salary_min || job.salary_max
          ? `${job.salary_currency || 'USD'} ${job.salary_min?.toLocaleString() ?? '?'}–${job.salary_max?.toLocaleString() ?? '?'}`
          : 'Not listed',
      jobType: job.job_type || 'Not specified',
      descriptionCharCount: (job.description || '').length,
      descriptionPreview: desc,
    },
    jdFacts: jd.facts,
  }
}

function parseEvaluatorJson(raw: string): Partial<JobEvaluation> & { resumeMatch?: string } {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  const candidate =
    jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed
  return JSON.parse(candidate) as Partial<JobEvaluation> & { resumeMatch?: string }
}

async function requestEvaluatorJson(
  ai: ReturnType<typeof getAIClient>,
  prompt: string
): Promise<Partial<JobEvaluation> & { resumeMatch?: string }> {
  const request = async (systemPrompt: string, userPrompt: string): Promise<string> => {
    const response = await ai.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { model: EVALUATOR_MODEL, responseFormat: 'json_object', maxTokens: 1500 }
    )

    return response.data.choices[0]?.message?.content ?? ''
  }

  const raw = await request(EVALUATOR_SYSTEM_PROMPT, prompt)
  try {
    return parseEvaluatorJson(raw)
  } catch (firstError) {
    const retryRaw = await request(
      `${EVALUATOR_SYSTEM_PROMPT}\nReturn exactly one complete valid JSON object. Do not include markdown, comments, or trailing text.`,
      `${prompt}\n\nYour previous response was invalid or incomplete JSON. Retry with a smaller complete JSON object that matches the requested schema exactly.`
    )

    try {
      return parseEvaluatorJson(retryRaw)
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : String(retryError)
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError)
      throw new Error(`Evaluator returned invalid JSON after retry: ${message}; first error: ${firstMessage}`)
    }
  }
}

function emptyProfileSource(kind: CandidateProfileSourceKind = 'none'): CandidateProfileSourceMetadata {
  return {
    kind,
    label: profileSourceLabel(kind),
    resumeId: null,
    resumeLabel: null,
    parsedResumeUsed: false,
    rawResumeTextUsed: false,
    applicationIdentitySupplemented: false,
    settingsDerivedSignalsUsed: false,
    settingsSignals: [],
    limitations: [],
  }
}

function buildPreFilterEvaluationResult(
  job: SearchJobResult,
  config: BotConfig,
  preFilter: Extract<ReturnType<typeof preFilterJob>, { rejected: true }>
): EvaluateJobResult {
  const evaluation: JobEvaluation = {
    score: preFilter.score,
    reasoning: preFilter.reason,
    shouldApply: false,
    flags: [preFilter.flag],
  }
  // Build minimal scoringInputs for audit trail (no resume load needed)
  const profileSource = emptyProfileSource()
  const minimalInputs: ScoringInputsSnapshot = {
    model: 'pre-filter',
    minScoreThreshold: config.minScore,
    userPreferences: {
      keywords: [...config.keywords],
      locations: [...config.locations],
      remoteOnly: config.remoteOnly,
      experienceLevel: config.experienceLevel ?? null,
      salaryMin: config.salaryMin ?? null,
      excludeCompanies: [...config.excludeCompanies],
      excludeKeywords: [...config.excludeKeywords],
      spokenLanguages: [...(config.spokenLanguages ?? [])],
    },
    resumeUsed: {
      resumeId: null,
      label: null,
      selection: 'none',
      sourceKind: 'none',
      sourceLabel: profileSource.label,
      skillsSentToPrompt: [],
      summaryIncluded: false,
      experienceRolesInPrompt: 0,
      educationRowsInPrompt: 0,
      applicationIdentitySupplemented: false,
      settingsDerivedSignalsUsed: false,
      settingsSignals: [],
      limitations: [],
    },
    profileSource,
    jobBlockSentToModel: {
      title: job.title,
      company: job.company,
      location: job.location || 'Not specified',
      remote: job.is_remote ? 'Yes' : job.is_remote === false ? 'No' : 'Not specified',
      salaryLine: 'Not listed',
      jobType: job.job_type || 'Not specified',
      descriptionCharCount: (job.description || '').length,
      descriptionPreview: '',
    },
  }
  return { evaluation, scoringInputs: minimalInputs }
}

async function evaluateJobWithResolvedProfile(
  job: SearchJobResult,
  config: BotConfig,
  candidateProfile: CandidateProfile
): Promise<EvaluateJobResult> {
  const ai = getAIClient()
  const { resume, source } = candidateProfile
  const prompt = buildEvalPrompt(job, config, resume, source)
  const scoringInputs = buildScoringInputsSnapshot(job, config, resume, source)
  const parsed = await requestEvaluatorJson(ai, prompt)

  const score =
    typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0
  const threshold = Math.max(0, Math.min(100, config.minScore))

  const resumeMatch =
    typeof parsed.resumeMatch === 'string' ? parsed.resumeMatch.slice(0, 2000) : undefined

  let evaluation: JobEvaluation = {
    score,
    reasoning: parsed.reasoning || '',
    shouldApply: score >= threshold,
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    resumeMatch,
  }

  const stackClamp = applyStackMismatchClamp(job, resume, evaluation, threshold)
  evaluation = stackClamp.evaluation

  let scoringInputsFinal: ScoringInputsSnapshot = stackClamp.clampMeta
    ? { ...scoringInputs, stackMismatchClamp: stackClamp.clampMeta }
    : scoringInputs

  const allowedLang = normalizeSpokenLanguageAllowlist(config.spokenLanguages ?? [])
  const langClamp = applyLanguageMismatchClamp(job, evaluation, threshold, allowedLang)
  evaluation = langClamp.evaluation
  if (langClamp.clampMeta) {
    scoringInputsFinal = { ...scoringInputsFinal, languageMismatchClamp: langClamp.clampMeta }
  }

  const geoClamp = applyGeoMismatchClamp(job, config, evaluation, threshold)
  evaluation = geoClamp.evaluation
  if (geoClamp.clampMeta) {
    scoringInputsFinal = { ...scoringInputsFinal, geoMismatchClamp: geoClamp.clampMeta }
  }

  const seniorityClamp = applySeniorityClamp(job, config, evaluation, threshold)
  evaluation = seniorityClamp.evaluation
  if (seniorityClamp.clampMeta) {
    scoringInputsFinal = { ...scoringInputsFinal, seniorityClamp: seniorityClamp.clampMeta }
  }

  const jdLenThin = (job.description ?? '').trim().length
  const isThinJd = jdLenThin < 80

  if (isThinJd && evaluation.score > 55) {
    evaluation = {
      ...evaluation,
      score: 55,
      shouldApply: 55 >= threshold,
      flags: Array.from(new Set([...evaluation.flags, 'thin_jd'])),
      reasoning:
        (evaluation.reasoning || '') +
        ' [Description under 80 characters — score capped at 55 (insufficient evidence).]',
    }
  }

  return {
    evaluation,
    scoringInputs: scoringInputsFinal,
  }
}

export async function evaluateJobWithCandidateProfile(
  job: SearchJobResult,
  config: BotConfig,
  candidateProfile: CandidateProfile
): Promise<EvaluateJobResult> {
  const preFilter = preFilterJob(job, config)
  if (preFilter.rejected) {
    return buildPreFilterEvaluationResult(job, config, preFilter)
  }

  return evaluateJobWithResolvedProfile(job, config, candidateProfile)
}

export async function evaluateJob(job: SearchJobResult, config: BotConfig): Promise<EvaluateJobResult> {
  // ── Deterministic pre-filter (runs before the LLM) ──────────────────────
  // Hard yes/no rules that are 100% reliable. The LLM is unreliable for
  // geography and seniority checks — code is not.
  const preFilter = preFilterJob(job, config)
  if (preFilter.rejected) {
    return buildPreFilterEvaluationResult(job, config, preFilter)
  }

  const candidateProfile = await loadCandidateProfileForEvaluation(config.userId, job.title, config)
  return evaluateJobWithResolvedProfile(job, config, candidateProfile)
}

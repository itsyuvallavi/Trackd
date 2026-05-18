/**
 * AI job evaluator.
 * Scores a job 0-100 based on the user's BotConfig and — when available —
 * the resume that best matches the job title.
 */

import { getAIClient } from '@/lib/ai/client'
import { prisma } from '@/lib/prisma'
import { pickResumeForJob } from './resume/parser'
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
import type { ApplicationProfile, BotConfig } from '@prisma/client'
import type { SearchJobResult, JobEvaluation } from './types'
import type { ResumeStructuredData } from './resume/types'
import { preFilterJob } from './pre-filter'

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
    selection: ResumeSelection
    skillsSentToPrompt: string[]
    summaryIncluded: boolean
    experienceRolesInPrompt: number
    educationRowsInPrompt: number
  }
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

type ResumeSelection = 'matched_by_keywords' | 'identity_fallback' | 'none'

function resumeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function resumeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

const KNOWN_SKILL_PATTERNS: Array<[string, RegExp]> = [
  ['React', /\breact(?:\.js|js)?\b/i],
  ['Next.js', /\bnext(?:\.js|js)\b/i],
  ['TypeScript', /\btypescript\b|\bts\b/i],
  ['JavaScript', /\bjavascript\b|\bjs\b/i],
  ['Node.js', /\bnode(?:\.js|js)\b/i],
  ['HTML', /\bhtml5?\b/i],
  ['CSS', /\bcss3?\b/i],
  ['Tailwind CSS', /\btailwind\b/i],
  ['Python', /\bpython\b/i],
  ['SQL', /\bsql\b/i],
  ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
  ['Supabase', /\bsupabase\b/i],
  ['Firebase', /\bfirebase\b/i],
  ['Prisma', /\bprisma\b/i],
  ['GraphQL', /\bgraphql\b/i],
  ['REST APIs', /\brest(?:ful)?\s+apis?\b|\bapi integrations?\b/i],
  ['Flutter', /\bflutter\b/i],
  ['React Native', /\breact native\b/i],
  ['AWS', /\baws\b|\bamazon web services\b/i],
  ['Docker', /\bdocker\b/i],
]

function deriveKnownSkillsFromText(rawText: string | null | undefined): string[] {
  if (!rawText) return []
  return KNOWN_SKILL_PATTERNS
    .filter(([, pattern]) => pattern.test(rawText))
    .map(([skill]) => skill)
}

function enrichResumeWithRawText(
  resume: ResumeStructuredData,
  rawText: string | null | undefined
): ResumeStructuredData {
  const rawSkills = deriveKnownSkillsFromText(rawText)
  if (rawSkills.length === 0) return resume

  const skills = Array.from(new Set([...resumeStringArray(resume.skills), ...rawSkills]))
  const rawSignalLine = `Additional parsed resume text signals: ${rawSkills.join(', ')}.`
  const summary = resume.summary
    ? resume.summary.includes(rawSignalLine)
      ? resume.summary
      : `${resume.summary} ${rawSignalLine}`
    : rawSignalLine

  return {
    ...resume,
    summary,
    skills,
  }
}

function resumeFromRawText(rawText: string | null | undefined, label: string): ResumeStructuredData | null {
  if (!rawText?.trim()) return null
  const skills = deriveKnownSkillsFromText(rawText)
  return {
    name: 'Candidate',
    email: '',
    summary: rawText.trim().slice(0, 1200),
    skills,
    languages: [],
    experience: [
      {
        company: label || 'Uploaded resume',
        title: 'Resume text',
        startDate: '',
        endDate: 'Present',
        description: rawText.trim().slice(0, 1200),
        achievements: [],
      },
    ],
    education: [],
    certifications: [],
  }
}

function buildEvalPrompt(
  job: SearchJobResult,
  config: BotConfig,
  resume: ResumeStructuredData | null
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

  const resumeSection = resume
    ? `
CANDIDATE RESUME:
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
    : '\nNo resume uploaded — evaluate based on preferences only.\n'

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
  resumeMeta: { id: string | null; label: string | null; selection: ResumeSelection }
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
      resumeId: resumeMeta.id,
      label: resumeMeta.label,
      selection: resumeMeta.selection,
      skillsSentToPrompt: resume ? resumeStringArray(resume.skills).slice(0, 30) : [],
      summaryIncluded: !!resume?.summary,
      experienceRolesInPrompt: resume
        ? Math.min(4, Array.isArray(resume.experience) ? resume.experience.length : 0)
        : 0,
      educationRowsInPrompt: resume && Array.isArray(resume.education) ? resume.education.length : 0,
    },
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

type LoadedResume = {
  resume: ResumeStructuredData | null
  resumeId: string | null
  label: string | null
  selection: ResumeSelection
}

function hasApplicationProfileData(profile: ApplicationProfile): boolean {
  return Boolean(
    profile.applicationFullName ||
      profile.applicationEmail ||
      profile.phone ||
      profile.city ||
      profile.state ||
      profile.country ||
      profile.linkedinUrl ||
      profile.githubUrl ||
      profile.portfolioUrl ||
      profile.workAuthorization ||
      profile.salaryExpectation ||
      profile.noticePeriod ||
      profile.yearsExperience
  )
}

function derivePreferenceSkills(config: BotConfig): string[] {
  const text = `${config.keywords.join(' ')} ${config.experienceLevel ?? ''}`.toLowerCase()
  const skills = new Set<string>()

  const addIf = (pattern: RegExp, values: string[]) => {
    if (!pattern.test(text)) return
    for (const value of values) skills.add(value)
  }

  addIf(/\breact\b/, ['React', 'Frontend Engineering'])
  addIf(/\bnext(?:\.js|js)?\b/, ['Next.js', 'React'])
  addIf(/\bfront(?:end|-end)\b/, ['Frontend Engineering'])
  addIf(/\bfull\s*stack\b|\bfullstack\b/, ['Full-stack Development'])
  addIf(/\bnode(?:\.js|js)?\b/, ['Node.js', 'Backend Engineering'])
  addIf(/\bback(?:end|-end)\b/, ['Backend Engineering'])
  addIf(/\btypescript\b|\bts\b/, ['TypeScript'])
  addIf(/\bjavascript\b|\bjs\b/, ['JavaScript'])
  addIf(/\bpython\b/, ['Python'])
  addIf(/\bai\b|\bartificial intelligence\b|\bgenai\b|\bgenerative ai\b/, ['AI Engineering'])
  addIf(/\bmachine learning\b|\bml\b/, ['Machine Learning'])
  addIf(/\bdata\b/, ['Data'])

  return [...skills]
}

function buildIdentityFallbackResume(
  profile: ApplicationProfile,
  config: BotConfig
): ResumeStructuredData | null {
  if (!hasApplicationProfileData(profile)) {
    return null
  }

  const location = [profile.city, profile.state, profile.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ')

  const preferenceSkills = derivePreferenceSkills(config)

  const summaryParts = [
    'No parsed resume is available; this profile is built from application identity fields and search preferences.',
    profile.yearsExperience ? `Reported experience: ${profile.yearsExperience} years` : null,
    config.experienceLevel ? `Preferred seniority: ${config.experienceLevel}` : null,
    config.keywords.length > 0 ? `Target roles: ${config.keywords.join(', ')}` : null,
    preferenceSkills.length > 0
      ? `Preference-derived role/stack signals: ${preferenceSkills.join(', ')}`
      : null,
    profile.workAuthorization ? `Work authorization: ${profile.workAuthorization}` : null,
    profile.requiresSponsorship ? 'Requires visa sponsorship' : 'Does not require visa sponsorship',
    profile.salaryExpectation ? `Salary expectation: ${profile.salaryExpectation}` : null,
    profile.noticePeriod ? `Notice period: ${profile.noticePeriod}` : null,
  ].filter(Boolean)

  const experienceDescription = [
    profile.yearsExperience ? `Candidate reported ${profile.yearsExperience} years of experience.` : null,
    config.keywords.length > 0 ? `Target roles from settings: ${config.keywords.join(', ')}.` : null,
    preferenceSkills.length > 0
      ? `Role/stack signals derived from settings: ${preferenceSkills.join(', ')}.`
      : null,
    config.experienceLevel ? `Preferred experience level: ${config.experienceLevel}.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    name: profile.applicationFullName || 'Candidate',
    email: profile.applicationEmail || '',
    phone: profile.phone || undefined,
    location: location || undefined,
    linkedin: profile.linkedinUrl || undefined,
    github: profile.githubUrl || undefined,
    portfolio: profile.portfolioUrl || undefined,
    summary: summaryParts.join(' '),
    skills: preferenceSkills,
    languages: config.spokenLanguages ?? [],
    experience: experienceDescription
      ? [
          {
            company: 'Application identity',
            title: config.experienceLevel ? `${config.experienceLevel} candidate profile` : 'Candidate profile',
            startDate: '',
            endDate: 'Present',
            description: experienceDescription,
            achievements: [],
          },
        ]
      : [],
    education: [],
    certifications: [],
  }
}

async function loadResumeForEvaluation(
  userId: string,
  jobTitle: string,
  config: BotConfig
): Promise<LoadedResume> {
  try {
    const resumes = await prisma.botResume.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        matchKeywords: true,
        isDefault: true,
        structuredData: true,
        rawText: true,
      },
    })

    if (resumes.length > 0) {
      const bestId = pickResumeForJob(resumes, jobTitle)
      const matched = resumes.find((r) => r.id === bestId)
      if (matched?.structuredData) {
        const structured = matched.structuredData as unknown as ResumeStructuredData
        return {
          resume: enrichResumeWithRawText(structured, matched.rawText),
          resumeId: matched.id,
          label: matched.label,
          selection: 'matched_by_keywords',
        }
      }
      if (matched?.rawText) {
        const rawResume = resumeFromRawText(matched.rawText, matched.label)
        if (rawResume) {
          return {
            resume: rawResume,
            resumeId: matched.id,
            label: matched.label,
            selection: 'matched_by_keywords',
          }
        }
      }
    }

    const profile = await prisma.applicationProfile.findUnique({ where: { userId } })
    if (profile) {
      const fallbackResume = buildIdentityFallbackResume(profile, config)
      if (fallbackResume) {
        return {
          resume: fallbackResume,
          resumeId: null,
          label: 'Application identity',
          selection: 'identity_fallback',
        }
      }
    }
  } catch (err) {
    console.warn('[evaluator] Could not load resumes:', err instanceof Error ? err.message : err)
  }
  return { resume: null, resumeId: null, label: null, selection: 'none' }
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

export async function evaluateJob(job: SearchJobResult, config: BotConfig): Promise<EvaluateJobResult> {
  // ── Deterministic pre-filter (runs before the LLM) ──────────────────────
  // Hard yes/no rules that are 100% reliable. The LLM is unreliable for
  // geography and seniority checks — code is not.
  const preFilter = preFilterJob(job, config)
  if (preFilter.rejected) {
    const evaluation: JobEvaluation = {
      score: preFilter.score,
      reasoning: preFilter.reason,
      shouldApply: false,
      flags: [preFilter.flag],
    }
    // Build minimal scoringInputs for audit trail (no resume load needed)
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
      resumeUsed: { resumeId: null, label: null, selection: 'none', skillsSentToPrompt: [], summaryIncluded: false, experienceRolesInPrompt: 0, educationRowsInPrompt: 0 },
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

  const ai = getAIClient()
  const { resume, resumeId, label, selection } = await loadResumeForEvaluation(config.userId, job.title, config)
  const resumeMeta = { id: resumeId, label, selection }
  const prompt = buildEvalPrompt(job, config, resume)
  const scoringInputs = buildScoringInputsSnapshot(job, config, resume, resumeMeta)
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

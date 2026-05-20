import type { ApplicationProfile, BotConfig } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pickResumeForJob } from './resume/parser'
import type { ResumeStructuredData } from './resume/types'
import type { CandidateProfileSourceKind } from './profile-source-labels'
import { profileSourceLabel } from './profile-source-labels'

type BotResumeCandidate = {
  id: string
  label: string
  matchKeywords: string[]
  isDefault: boolean
  structuredData: unknown
  rawText?: string | null
}

export type CandidateProfileSourceMetadata = {
  kind: CandidateProfileSourceKind
  label: string
  resumeId: string | null
  resumeLabel: string | null
  parsedResumeUsed: boolean
  rawResumeTextUsed: boolean
  applicationIdentitySupplemented: boolean
  settingsDerivedSignalsUsed: boolean
  settingsSignals: string[]
  limitations: string[]
}

export type CandidateProfile = {
  resume: ResumeStructuredData | null
  source: CandidateProfileSourceMetadata
}

export function resumeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function resumeStringArray(value: unknown): string[] {
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

function cleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function deriveKnownSkillsFromText(rawText: string | null | undefined): string[] {
  if (!rawText) return []
  return KNOWN_SKILL_PATTERNS
    .filter(([, pattern]) => pattern.test(rawText))
    .map(([skill]) => skill)
}

function normalizeResume(resume: ResumeStructuredData): ResumeStructuredData {
  return {
    ...resume,
    name: resumeString(resume.name, 'Candidate'),
    email: resumeString(resume.email),
    skills: resumeStringArray(resume.skills),
    languages: resumeStringArray(resume.languages),
    experience: Array.isArray(resume.experience) ? resume.experience : [],
    education: Array.isArray(resume.education) ? resume.education : [],
    certifications: resumeStringArray(resume.certifications),
  }
}

export function enrichResumeWithRawText(
  resume: ResumeStructuredData,
  rawText: string | null | undefined
): ResumeStructuredData {
  const rawSkills = deriveKnownSkillsFromText(rawText)
  if (rawSkills.length === 0) return normalizeResume(resume)

  const normalized = normalizeResume(resume)
  const skills = uniqueStrings([...normalized.skills, ...rawSkills])
  const rawSignalLine = `Additional parsed resume text signals: ${rawSkills.join(', ')}.`
  const summary = normalized.summary
    ? normalized.summary.includes(rawSignalLine)
      ? normalized.summary
      : `${normalized.summary} ${rawSignalLine}`
    : rawSignalLine

  return {
    ...normalized,
    summary,
    skills,
  }
}

export function resumeFromRawText(
  rawText: string | null | undefined,
  label: string
): ResumeStructuredData | null {
  if (!rawText?.trim()) return null
  const excerpt = rawText.trim().slice(0, 1200)
  const skills = deriveKnownSkillsFromText(rawText)
  return {
    name: 'Candidate',
    email: '',
    summary:
      'Parsed resume fields are unavailable; scoring is using extracted resume text. ' +
      excerpt,
    skills,
    languages: [],
    experience: [
      {
        company: label || 'Uploaded resume',
        title: 'Resume text',
        startDate: '',
        endDate: 'Present',
        description: excerpt,
        achievements: [],
      },
    ],
    education: [],
    certifications: [],
  }
}

export function hasApplicationProfileData(profile: ApplicationProfile): boolean {
  return Boolean(
    cleanString(profile.applicationFullName) ||
      cleanString(profile.applicationEmail) ||
      cleanString(profile.phone) ||
      cleanString(profile.city) ||
      cleanString(profile.state) ||
      cleanString(profile.country) ||
      cleanString(profile.linkedinUrl) ||
      cleanString(profile.githubUrl) ||
      cleanString(profile.portfolioUrl) ||
      cleanString(profile.workAuthorization) ||
      profile.salaryExpectation != null ||
      cleanString(profile.noticePeriod) ||
      profile.yearsExperience != null ||
      profile.requiresSponsorship
  )
}

function profileLocation(profile: ApplicationProfile): string | null {
  const location = [profile.city, profile.state, profile.country]
    .map((part) => cleanString(part))
    .filter((part): part is string => Boolean(part))
    .join(', ')
  return location || null
}

function identitySummaryLine(profile: ApplicationProfile): string | null {
  const parts = [
    profileLocation(profile) ? `Location: ${profileLocation(profile)}` : null,
    cleanString(profile.workAuthorization)
      ? `Work authorization: ${cleanString(profile.workAuthorization)}`
      : null,
    profile.requiresSponsorship ? 'Requires visa sponsorship' : null,
  ].filter(Boolean)

  if (parts.length === 0) return null
  return `Application Identity supplemental info: ${parts.join('; ')}.`
}

function mergeApplicationIdentity(
  resume: ResumeStructuredData,
  profile: ApplicationProfile | null
): { resume: ResumeStructuredData; supplemented: boolean } {
  if (!profile || !hasApplicationProfileData(profile)) {
    return { resume: normalizeResume(resume), supplemented: false }
  }

  const normalized = normalizeResume(resume)
  const location = profileLocation(profile)
  const identityLine = identitySummaryLine(profile)
  const summary =
    identityLine && !normalized.summary?.includes(identityLine)
      ? [normalized.summary, identityLine].filter(Boolean).join(' ')
      : normalized.summary

  return {
    resume: {
      ...normalized,
      name: normalized.name || profile.applicationFullName || 'Candidate',
      email: normalized.email || profile.applicationEmail || '',
      phone: normalized.phone || profile.phone || undefined,
      location: normalized.location || location || undefined,
      linkedin: normalized.linkedin || profile.linkedinUrl || undefined,
      github: normalized.github || profile.githubUrl || undefined,
      portfolio: normalized.portfolio || profile.portfolioUrl || undefined,
      summary,
    },
    supplemented: true,
  }
}

export function derivePreferenceSkills(config: BotConfig): string[] {
  const text = `${config.keywords.join(' ')} ${config.experienceLevel ?? ''}`.toLowerCase()
  const skills = new Set<string>()

  const addIf = (pattern: RegExp, values: string[]) => {
    if (!pattern.test(text)) return
    for (const value of values) skills.add(value)
  }

  addIf(/\breact\b/, ['React', 'Frontend Engineering'])
  addIf(/\bnext(?:\.js|js)?\b/, ['Next.js', 'React'])
  addIf(/\bfront(?:end|-end)\b/, ['Frontend Engineering'])
  addIf(/\bfull[-\s]*stack\b|\bfullstack\b/, ['Full-stack Development'])
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

function sourceMeta(input: {
  kind: CandidateProfileSourceKind
  resumeId?: string | null
  resumeLabel?: string | null
  parsedResumeUsed?: boolean
  rawResumeTextUsed?: boolean
  applicationIdentitySupplemented?: boolean
  settingsDerivedSignalsUsed?: boolean
  settingsSignals?: string[]
  limitations?: string[]
}): CandidateProfileSourceMetadata {
  return {
    kind: input.kind,
    label: profileSourceLabel(input.kind),
    resumeId: input.resumeId ?? null,
    resumeLabel: input.resumeLabel ?? null,
    parsedResumeUsed: input.parsedResumeUsed ?? false,
    rawResumeTextUsed: input.rawResumeTextUsed ?? false,
    applicationIdentitySupplemented: input.applicationIdentitySupplemented ?? false,
    settingsDerivedSignalsUsed: input.settingsDerivedSignalsUsed ?? false,
    settingsSignals: input.settingsSignals ?? [],
    limitations: input.limitations ?? [],
  }
}

function orderedResumes(
  resumes: BotResumeCandidate[],
  jobTitle: string
): BotResumeCandidate[] {
  const preferredId = pickResumeForJob(resumes, jobTitle)
  const out: BotResumeCandidate[] = []
  const seen = new Set<string>()
  const push = (resume: BotResumeCandidate | undefined) => {
    if (!resume || seen.has(resume.id)) return
    seen.add(resume.id)
    out.push(resume)
  }

  push(resumes.find((r) => r.id === preferredId))
  push(resumes.find((r) => r.isDefault))
  for (const resume of resumes) push(resume)
  return out
}

function buildNoResumeFallback(
  profile: ApplicationProfile | null,
  config: BotConfig
): CandidateProfile {
  const settingsSignals = derivePreferenceSkills(config)
  const hasIdentity = profile ? hasApplicationProfileData(profile) : false

  if (profile && hasIdentity) {
    const location = profileLocation(profile)
    const summaryParts = [
      'No usable Job Search resume content is available; this limited profile is built from Application Identity and search preferences.',
      profile.yearsExperience != null ? `Reported experience: ${profile.yearsExperience} years` : null,
      location ? `Location: ${location}` : null,
      cleanString(profile.workAuthorization)
        ? `Work authorization: ${cleanString(profile.workAuthorization)}`
        : null,
      profile.requiresSponsorship ? 'Requires visa sponsorship' : 'Does not require visa sponsorship',
      config.experienceLevel ? `Preferred seniority: ${config.experienceLevel}` : null,
      config.keywords.length > 0 ? `Target roles from settings: ${config.keywords.join(', ')}` : null,
      settingsSignals.length > 0
        ? `Settings-derived role/stack signals (not resume evidence): ${settingsSignals.join(', ')}`
        : null,
    ].filter(Boolean)

    const fallback: ResumeStructuredData = {
      name: profile.applicationFullName || 'Candidate',
      email: profile.applicationEmail || '',
      phone: profile.phone || undefined,
      location: location || undefined,
      linkedin: profile.linkedinUrl || undefined,
      github: profile.githubUrl || undefined,
      portfolio: profile.portfolioUrl || undefined,
      summary: summaryParts.join(' '),
      skills: settingsSignals,
      languages: config.spokenLanguages ?? [],
      experience: [
        {
          company: 'Application Identity',
          title: config.experienceLevel
            ? `${config.experienceLevel} candidate profile`
            : 'Candidate profile',
          startDate: '',
          endDate: 'Present',
          description: [
            profile.yearsExperience != null
              ? `Candidate reported ${profile.yearsExperience} years of experience.`
              : null,
            config.keywords.length > 0
              ? `Target roles from settings: ${config.keywords.join(', ')}.`
              : null,
            settingsSignals.length > 0
              ? `Settings-derived role/stack signals: ${settingsSignals.join(', ')}.`
              : null,
          ]
            .filter(Boolean)
            .join(' '),
          achievements: [],
        },
      ],
      education: [],
      certifications: [],
    }

    return {
      resume: fallback,
      source: sourceMeta({
        kind: 'application_identity_fallback',
        applicationIdentitySupplemented: true,
        settingsDerivedSignalsUsed: settingsSignals.length > 0,
        settingsSignals,
        limitations: [
          'No usable Job Search resume content is available for this user.',
          'Settings-derived role/stack signals are not treated as resume evidence.',
        ],
      }),
    }
  }

  if (settingsSignals.length > 0 || config.keywords.length > 0) {
    const fallback: ResumeStructuredData = {
      name: 'Candidate',
      email: '',
      summary: [
        'No usable Job Search resume content or Application Identity is available.',
        config.keywords.length > 0 ? `Target roles from settings: ${config.keywords.join(', ')}` : null,
        settingsSignals.length > 0
          ? `Settings-derived role/stack signals (not resume evidence): ${settingsSignals.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join(' '),
      skills: settingsSignals,
      languages: config.spokenLanguages ?? [],
      experience: [],
      education: [],
      certifications: [],
    }

    return {
      resume: fallback,
      source: sourceMeta({
        kind: 'settings_fallback',
        settingsDerivedSignalsUsed: settingsSignals.length > 0,
        settingsSignals,
        limitations: [
          'No usable Job Search resume content is available for this user.',
          'No Application Identity fallback exists for this user.',
          'Settings-derived role/stack signals are not treated as resume evidence.',
        ],
      }),
    }
  }

  return {
    resume: null,
    source: sourceMeta({
      kind: 'none',
      limitations: [
        'No usable Job Search resume content, Application Identity, or settings-derived profile signals are available.',
      ],
    }),
  }
}

export function buildCandidateProfileFromSources(input: {
  resumes: BotResumeCandidate[]
  applicationProfile: ApplicationProfile | null
  config: BotConfig
  jobTitle: string
}): CandidateProfile {
  const ordered = orderedResumes(input.resumes, input.jobTitle)

  const parsed = ordered.find((resume) => resume.structuredData)
  if (parsed?.structuredData) {
    const structured = parsed.structuredData as ResumeStructuredData
    const enriched = enrichResumeWithRawText(structured, parsed.rawText)
    const merged = mergeApplicationIdentity(enriched, input.applicationProfile)
    return {
      resume: merged.resume,
      source: sourceMeta({
        kind: 'parsed_resume',
        resumeId: parsed.id,
        resumeLabel: parsed.label,
        parsedResumeUsed: true,
        rawResumeTextUsed: Boolean(parsed.rawText?.trim()),
        applicationIdentitySupplemented: merged.supplemented,
      }),
    }
  }

  const raw = ordered.find((resume) => resume.rawText?.trim())
  if (raw?.rawText) {
    const rawResume = resumeFromRawText(raw.rawText, raw.label)
    if (rawResume) {
      const merged = mergeApplicationIdentity(rawResume, input.applicationProfile)
      return {
        resume: merged.resume,
        source: sourceMeta({
          kind: 'raw_resume_fallback',
          resumeId: raw.id,
          resumeLabel: raw.label,
          rawResumeTextUsed: true,
          applicationIdentitySupplemented: merged.supplemented,
          limitations: ['Parsed resume fields are unavailable; using extracted resume text.'],
        }),
      }
    }
  }

  return buildNoResumeFallback(input.applicationProfile, input.config)
}

export async function loadCandidateProfileForEvaluation(
  userId: string,
  jobTitle: string,
  config: BotConfig
): Promise<CandidateProfile> {
  try {
    const [resumes, applicationProfile] = await Promise.all([
      prisma.botResume.findMany({
        where: { userId },
        select: {
          id: true,
          label: true,
          matchKeywords: true,
          isDefault: true,
          structuredData: true,
          rawText: true,
        },
      }),
      prisma.applicationProfile.findUnique({ where: { userId } }),
    ])

    return buildCandidateProfileFromSources({
      resumes,
      applicationProfile,
      config,
      jobTitle,
    })
  } catch (err) {
    console.warn('[evaluator] Could not load candidate profile:', err instanceof Error ? err.message : err)
  }

  return {
    resume: null,
    source: sourceMeta({
      kind: 'none',
      limitations: ['Candidate profile lookup failed.'],
    }),
  }
}

export type CandidateProfileSourceKind =
  | 'parsed_resume'
  | 'raw_resume_fallback'
  | 'application_identity_fallback'
  | 'settings_fallback'
  | 'none'

export type ProfileSourceTone = 'ready' | 'limited' | 'missing'

export type ResumeReadinessCounts = {
  totalCount: number
  parsedCount: number
  rawTextCount: number
  hasIdentityFallback: boolean
}

export type ResumeReadinessSource = {
  kind: CandidateProfileSourceKind
  label: string
  description: string
  tone: ProfileSourceTone
  isResumeBacked: boolean
  requiresResumeWarning: boolean
}

export function profileSourceLabel(kind: CandidateProfileSourceKind): string {
  switch (kind) {
    case 'parsed_resume':
      return 'Parsed resume'
    case 'raw_resume_fallback':
      return 'Raw resume fallback'
    case 'application_identity_fallback':
      return 'Application Identity fallback'
    case 'settings_fallback':
      return 'Search settings fallback'
    case 'none':
      return 'No profile source'
  }
}

export function resolveResumeReadinessSource(
  counts: ResumeReadinessCounts
): ResumeReadinessSource {
  if (counts.parsedCount > 0) {
    return {
      kind: 'parsed_resume',
      label: profileSourceLabel('parsed_resume'),
      description: 'Job Search scoring is resume-backed.',
      tone: 'ready',
      isResumeBacked: true,
      requiresResumeWarning: false,
    }
  }

  if (counts.rawTextCount > 0) {
    return {
      kind: 'raw_resume_fallback',
      label: profileSourceLabel('raw_resume_fallback'),
      description: 'Scoring can use extracted resume text, but parsed fields are unavailable.',
      tone: 'limited',
      isResumeBacked: true,
      requiresResumeWarning: false,
    }
  }

  if (counts.hasIdentityFallback) {
    return {
      kind: 'application_identity_fallback',
      label: profileSourceLabel('application_identity_fallback'),
      description: 'Scoring is limited until usable Job Search resume content is available.',
      tone: 'limited',
      isResumeBacked: false,
      requiresResumeWarning: true,
    }
  }

  return {
    kind: 'settings_fallback',
    label: profileSourceLabel('settings_fallback'),
    description: 'Scoring can only use search preferences until usable resume content is available.',
    tone: counts.totalCount > 0 ? 'limited' : 'missing',
    isResumeBacked: false,
    requiresResumeWarning: true,
  }
}

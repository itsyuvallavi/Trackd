export type SetupReadiness = {
  hasResume: boolean
  hasParsedResume: boolean
  hasProfile: boolean
  hasKeywords: boolean
  hasSearchTerms: boolean
  isComplete: boolean
}

export function isApplicationProfileComplete(
  profile: {
    phone: string | null
    workAuthorization: string | null
    city: string | null
    applicationFullName: string | null
    applicationEmail: string | null
  } | null
): boolean {
  if (!profile) return false
  return !!(
    profile.phone?.trim() &&
    profile.workAuthorization?.trim() &&
    profile.city?.trim() &&
    profile.applicationFullName?.trim() &&
    profile.applicationEmail?.trim()
  )
}

export function buildSetupReadiness(input: {
  resumeCount: number
  parsedResumeCount: number
  applicationProfile: Parameters<typeof isApplicationProfileComplete>[0]
  keywordCount: number
  searchableTermCount?: number
}): SetupReadiness {
  const hasResume = input.resumeCount > 0
  const hasParsedResume = input.parsedResumeCount > 0
  const hasProfile = isApplicationProfileComplete(input.applicationProfile)
  const hasKeywords = input.keywordCount > 0
  const hasSearchTerms = (input.searchableTermCount ?? input.keywordCount) > 0

  return {
    hasResume,
    hasParsedResume,
    hasProfile,
    hasKeywords,
    hasSearchTerms,
    isComplete: hasResume && hasProfile && hasSearchTerms,
  }
}

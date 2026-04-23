/**
 * Maps the user's BotConfig.experienceLevel (the value saved from /settings/bot)
 * onto the parameters each downstream search adapter understands.
 *
 *   BotConfig.experienceLevel values (see /settings/bot EXPERIENCE_OPTIONS):
 *     '' | 'internship' | 'entry_level' | 'mid_level' | 'senior_level' | 'director'
 *
 * JSearch uses `job_requirements` with a comma-separated list of tags:
 *   no_experience | no_degree | under_3_years_experience | more_than_3_years_experience
 *   (https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
 *
 * Jobs Search API (getjobs_excel) doesn't accept experience directly, so we
 * append a hint to the search term (e.g. "senior", "intern") when it's safe.
 */

export type NormalizedExperienceLevel =
  | 'internship'
  | 'entry_level'
  | 'mid_level'
  | 'senior_level'
  | 'director'
  | 'any'

export function normalizeExperienceLevel(raw: string | null | undefined): NormalizedExperienceLevel {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || v === 'any') return 'any'
  if (v.startsWith('intern')) return 'internship'
  if (v.startsWith('entry')) return 'entry_level'
  if (v.startsWith('mid')) return 'mid_level'
  if (v.startsWith('senior') || v === 'sr' || v === 'sr.') return 'senior_level'
  if (v.startsWith('director') || v.startsWith('head') || v.startsWith('principal')) return 'director'
  return 'any'
}

/**
 * Returns the JSearch `job_requirements` tags for a given level, or null for "any".
 * Multiple tags are joined with ',' on the caller side.
 */
export function jsearchJobRequirementsFor(level: NormalizedExperienceLevel): string | null {
  switch (level) {
    case 'internship':
      return 'no_experience,no_degree'
    case 'entry_level':
      return 'no_experience,under_3_years_experience'
    case 'mid_level':
      return 'under_3_years_experience,more_than_3_years_experience'
    case 'senior_level':
      return 'more_than_3_years_experience'
    case 'director':
      return 'more_than_3_years_experience'
    case 'any':
    default:
      return null
  }
}

/**
 * Returns a short keyword hint to append to the free-text search term for the
 * Jobs Search API (which has no `experience_level` parameter). `null` when the
 * user picked "any".
 */
export function jobsSearchApiSearchHint(level: NormalizedExperienceLevel): string | null {
  switch (level) {
    case 'internship':
      return 'intern'
    case 'entry_level':
      return 'junior'
    case 'mid_level':
      return null // avoid noisy "mid" token; most boards don't tag it
    case 'senior_level':
      return 'senior'
    case 'director':
      return 'director'
    case 'any':
    default:
      return null
  }
}

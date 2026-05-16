/**
 * Maps the user's BotConfig.experienceLevel (the value saved from /settings/bot)
 * onto search terms the downstream search adapter understands.
 *
 *   BotConfig.experienceLevel values (see /settings/bot EXPERIENCE_OPTIONS):
 *     '' | 'internship' | 'entry_level' | 'mid_level' | 'senior_level' | 'director'
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

/**
 * Turns the free-form "Target locations" strings a user enters on /settings/bot
 * into normalized tokens for matching against JD text.
 *
 * Example inputs:
 *   ["Portugal", "Remote EU", "New York, NY", "United States", "Remote"]
 * Produces tokens the geo clamp and the JD-excerpt use to decide whether a
 * JD-mandated location overlaps with what the user selected.
 *
 * No hardcoded "US is bad" logic — the user's list is the source of truth.
 */

export type UserLocationTokens = {
  /** Raw trimmed entries from BotConfig.locations. */
  raw: string[]
  /** Lowercased free-text tokens used for substring/word checks. */
  tokens: Set<string>
  /** Lowercased country/region names detected in the raw list. */
  countries: Set<string>
  /** Lowercased city/town names detected in the raw list. */
  cities: Set<string>
  /** True when the user explicitly mentioned a remote/worldwide token ("remote", "anywhere", "worldwide"). */
  hasRemoteToken: boolean
  /** True when the user's locations list is empty → treat as "anywhere". */
  isAny: boolean
  /** True when the user listed "Europe" (or EMEA) — semantically covers all European countries. */
  hasEuropeToken: boolean
  /** True when the user listed "EU" (European Union) — semantically covers all EU member states. */
  hasEuToken: boolean
}

/** All 27 EU member states (lowercase). */
export const EU_MEMBER_COUNTRIES = new Set([
  'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech republic',
  'czechia', 'denmark', 'estonia', 'finland', 'france', 'germany', 'greece',
  'hungary', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg', 'malta',
  'netherlands', 'poland', 'portugal', 'romania', 'slovakia', 'slovenia',
  'spain', 'sweden',
])

/**
 * All geographically-European countries/territories (broader than EU).
 * Includes UK, Norway, Switzerland, EEA, Western Balkans, etc.
 */
export const EUROPE_COUNTRIES = new Set([
  ...EU_MEMBER_COUNTRIES,
  // EEA / EFTA
  'united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales',
  'northern ireland', 'norway', 'switzerland', 'iceland', 'liechtenstein',
  // Candidate / official applicant
  'albania', 'north macedonia', 'serbia', 'turkey', 'ukraine', 'moldova',
  'georgia', 'armenia', 'azerbaijan', 'bosnia and herzegovina', 'kosovo',
  'montenegro',
  // Micro-states
  'monaco', 'andorra', 'san marino', 'vatican', 'malta',
  // Broader CIS/Eastern Europe
  'russia', 'belarus',
])

/** Country/region aliases → canonical lowercase name (extend as needed). */
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'united states',
  usa: 'united states',
  'u.s.': 'united states',
  'u.s.a.': 'united states',
  america: 'united states',
  'united states': 'united states',
  'united states of america': 'united states',
  uk: 'united kingdom',
  'u.k.': 'united kingdom',
  'great britain': 'united kingdom',
  britain: 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  'northern ireland': 'united kingdom',
  'united kingdom': 'united kingdom',
  eu: 'european union',
  europe: 'europe',
  'european union': 'european union',
  emea: 'emea',
  latam: 'latam',
  'latin america': 'latam',
  apac: 'apac',
  'asia pacific': 'apac',
  portugal: 'portugal',
  spain: 'spain',
  france: 'france',
  germany: 'germany',
  italy: 'italy',
  netherlands: 'netherlands',
  ireland: 'ireland',
  poland: 'poland',
  romania: 'romania',
  sweden: 'sweden',
  norway: 'norway',
  denmark: 'denmark',
  finland: 'finland',
  canada: 'canada',
  mexico: 'mexico',
  brazil: 'brazil',
  argentina: 'argentina',
  india: 'india',
  china: 'china',
  japan: 'japan',
  singapore: 'singapore',
  australia: 'australia',
  'new zealand': 'new zealand',
  israel: 'israel',
  ae: 'united arab emirates',
  uae: 'united arab emirates',
}

const US_STATE_CODES = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id',
  'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms',
  'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok',
  'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv',
  'wi', 'wy',
])

/** Tokens the user may write to mean "anywhere / remote / worldwide". */
const REMOTE_TOKENS = new Set([
  'remote',
  'anywhere',
  'worldwide',
  'global',
  'work from home',
  'wfh',
  'remote-first',
  'remote first',
])

const REMOTE_WORK_SIGNAL_RE =
  /\b(?:remote|remotely|remoto|remota|remotos|remotas|telework|telecommute|telecommuting|teletrabalho|teletrabajo|teletravail|home\s*office|work\s+from\s+home|wfh)\b|100%\s*(?:remote|remoto|remota)/i

export function hasRemoteWorkSignal(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[-_/]+/g, ' ')
  return REMOTE_WORK_SIGNAL_RE.test(normalized)
}

export function parseUserLocations(raw: string[] | null | undefined): UserLocationTokens {
  const cleaned = (raw ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (cleaned.length === 0) {
    return {
      raw: [],
      tokens: new Set(),
      countries: new Set(),
      cities: new Set(),
      hasRemoteToken: false,
      isAny: true,
      hasEuropeToken: false,
      hasEuToken: false,
    }
  }

  const tokens = new Set<string>()
  const countries = new Set<string>()
  const cities = new Set<string>()
  let hasRemoteToken = false

  for (const entry of cleaned) {
    const lower = entry.toLowerCase()
    tokens.add(lower)

    const pieces = lower
      .split(/[,;/]+/)
      .map((p) => p.trim())
      .filter(Boolean)

    for (const piece of pieces) {
      tokens.add(piece)
      if (REMOTE_TOKENS.has(piece)) {
        hasRemoteToken = true
        continue
      }

      const canonical = COUNTRY_ALIASES[piece]
      if (canonical) {
        countries.add(canonical)
        continue
      }

      // "Remote Europe", "Remote - Portugal", "Remote EU"
      if (piece.startsWith('remote')) {
        hasRemoteToken = true
        const rest = piece.replace(/^remote[-\s]+/, '').trim()
        if (rest) {
          const canonicalRest = COUNTRY_ALIASES[rest] ?? rest
          if (canonicalRest) countries.add(canonicalRest)
        }
        continue
      }

      // "New York, NY" — the "ny" piece is a state code + "new york" is the city.
      if (piece.length === 2 && US_STATE_CODES.has(piece)) {
        countries.add('united states')
        continue
      }

      // Fallback: treat it as a city (we accept free-form city names).
      if (piece.length >= 2) cities.add(piece)
    }
  }

  const hasEuropeToken =
    countries.has('europe') ||
    countries.has('emea') ||
    [...tokens].some((t) => t === 'europe' || t === 'emea' || t.startsWith('remote europe') || t.startsWith('remote emea'))
  const hasEuToken = countries.has('european union') || [...tokens].some((t) => t === 'eu')

  return {
    raw: cleaned,
    tokens,
    countries,
    cities,
    hasRemoteToken,
    isAny: false,
    hasEuropeToken,
    hasEuToken,
  }
}

/** Does a user's tokens set include the United States (country or state code)? */
export function userAcceptsUnitedStates(user: UserLocationTokens): boolean {
  return user.countries.has('united states')
}

// ── Listing / board location line → country tokens (shared: pre-filter, geo clamp) ──

const JOB_LOC_US_STATE_CODES = new Set([
  'al',
  'ak',
  'az',
  'ar',
  'ca',
  'co',
  'ct',
  'de',
  'fl',
  'ga',
  'hi',
  'id',
  'il',
  'in',
  'ia',
  'ks',
  'ky',
  'la',
  'me',
  'md',
  'ma',
  'mi',
  'mn',
  'ms',
  'mo',
  'mt',
  'ne',
  'nv',
  'nh',
  'nj',
  'nm',
  'ny',
  'nc',
  'nd',
  'oh',
  'ok',
  'or',
  'pa',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'ut',
  'vt',
  'va',
  'wa',
  'wv',
  'wi',
  'wy',
  'dc',
])

/**
 * Country / region tokens inferred from a job board "Location" field
 * (e.g. "London, England, UK" → united kingdom, london, uk).
 */
export function countryTokensFromJobLocationLine(location: string): string[] {
  const loc = location.trim()
  if (!loc) return []

  if (/^remote$/i.test(loc)) return []
  if (/\bremote\b/i.test(loc)) {
    const qualifier = loc
      .replace(/\bremote\b/gi, ' ')
      .replace(/\b(?:within|from|based\s+in|only|anywhere\s+in)\b/gi, ' ')
      .replace(/[()[\]{}|/\\–—-]+/g, ',')
      .replace(/\s+/g, ' ')
      .trim()

    if (!qualifier || /^,+$/.test(qualifier)) return []

    const qualifierTokens = countryTokensFromJobLocationLine(qualifier)
    if (qualifierTokens.length > 0) return qualifierTokens
    return []
  }

  if (/^(n\/a|not specified|unknown)$/i.test(loc)) return []

  const parts = loc
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (parts.length === 0) return []

  const last = parts[parts.length - 1]

  const normalise = (t: string): string => {
    if (/^(uk|great britain|england|scotland|wales|northern ireland)$/.test(t))
      return 'united kingdom'
    if (/^(usa|u\.s\.a?\.?|us|united states of america)$/.test(t)) return 'united states'
    return t
  }

  const candidates = new Set<string>()

  if (JOB_LOC_US_STATE_CODES.has(last)) {
    candidates.add('united states')
    if (parts.length >= 3) {
      const thirdLast = parts[parts.length - 3]
      candidates.add(thirdLast)
      candidates.add(normalise(thirdLast))
    }
  } else {
    candidates.add(last)
    candidates.add(normalise(last))
    if (parts.length >= 2) {
      candidates.add(parts[0])
    }
  }

  return [...candidates].filter(Boolean)
}

/** Returns the distinct country tokens intersecting a JD text (country-name substring match). */
export function jdMentionsUserCountries(
  jdLower: string,
  user: UserLocationTokens
): string[] {
  const hits: string[] = []
  for (const country of user.countries) {
    if (jdLower.includes(country)) hits.push(country)
  }
  return hits
}

/** Returns the distinct city tokens intersecting a JD text. */
export function jdMentionsUserCities(
  jdLower: string,
  user: UserLocationTokens
): string[] {
  const hits: string[] = []
  for (const city of user.cities) {
    if (city.length < 2) continue
    if (jdLower.includes(city)) hits.push(city)
  }
  return hits
}

/**
 * Checks whether a given JD region snippet (city or country name extracted by a regex)
 * overlaps with the user's locations. Returns true when the JD is acceptable.
 *
 * Semantic expansion: "Europe" covers European countries (including UK); "EU" covers
 * EU member states only. Remote vs on-site is enforced separately (see pre-filter
 * `checkRemoteWorkPolicy`).
 */
export function jdLocationOverlapsUser(
  jdMentionedNames: string[],
  user: UserLocationTokens
): boolean {
  if (user.isAny) return true
  if (jdMentionedNames.length === 0) return false

  const userSet = new Set<string>([...user.countries, ...user.cities, ...user.tokens])

  return jdMentionedNames.some((name) => {
    const lower = name.toLowerCase()

    // Direct / substring match
    if (userSet.has(lower)) return true
    for (const tok of userSet) {
      if (!tok || tok.length < 3) continue
      if (lower.includes(tok) || tok.includes(lower)) return true
    }

    if (user.hasEuropeToken && EUROPE_COUNTRIES.has(lower)) return true

    if (user.hasEuToken && EU_MEMBER_COUNTRIES.has(lower)) return true

    return false
  })
}

/**
 * True when the user expects remote-first hiring: Remote / Europe / EU scope, or the
 * bot "remote only" toggle. On-site/hybrid is then only OK in cities they explicitly
 * listed (e.g. Lisbon, Porto).
 */
export function userWantsRemoteFirstUnlessListedCities(
  user: UserLocationTokens,
  remoteOnly: boolean
): boolean {
  if (user.isAny) return false
  if (remoteOnly) return true
  if (user.hasEuropeToken || user.hasEuToken) return true
  if (user.hasRemoteToken) return true
  for (const c of user.countries) {
    if (EU_MEMBER_COUNTRIES.has(c) || EUROPE_COUNTRIES.has(c)) return true
  }
  return false
}

/** True if on-site / required-location snippets name at least one of the user's cities. */
export function jdOnsiteBlobIncludesUserCity(
  onsiteCityPhrases: string[],
  requiredLocations: string[],
  user: UserLocationTokens
): boolean {
  const blob = [...onsiteCityPhrases, ...requiredLocations].join(' ').toLowerCase()
  for (const city of user.cities) {
    if (city.length < 3) continue
    if (blob.includes(city)) return true
  }
  return false
}

import {
  parseUserLocations,
  userAcceptsUnitedStates,
} from './user-locations'

const CORE_BOARDS = ['linkedin', 'glassdoor'] as const
const US_BOARDS = ['linkedin', 'glassdoor', 'zip_recruiter'] as const
const INDIA_BOARDS = ['linkedin', 'glassdoor', 'naukri'] as const
const MIDDLE_EAST_BOARDS = ['linkedin', 'glassdoor', 'bayt'] as const

function normaliseSiteName(name: string): string | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  if (n === 'ziprecruiter') return 'zip_recruiter'
  return n
}

export function explicitJobsSearchSiteNames(): string[] | null {
  const raw = process.env.JOBS_SEARCH_SITE_NAMES?.trim()
  if (!raw) return null
  const names = raw
    .split(',')
    .map((name) => normaliseSiteName(name))
    .filter((name): name is string => Boolean(name))
  return names.length > 0 ? Array.from(new Set(names)) : null
}

export function resolveJobsSearchSiteNames(input: {
  locations: string[]
  remoteOnly?: boolean
}): { siteNames: string[]; reason: string } {
  const explicit = explicitJobsSearchSiteNames()
  if (explicit) return { siteNames: explicit, reason: 'env_override' }

  const user = parseUserLocations(input.locations)
  const tokens = new Set([...user.tokens, ...user.countries, ...user.cities])

  const hasIndiaScope =
    user.countries.has('india') ||
    user.countries.has('apac') ||
    tokens.has('india') ||
    tokens.has('apac')
  if (hasIndiaScope) {
    return { siteNames: [...INDIA_BOARDS], reason: 'india_or_apac_scope' }
  }

  const hasMiddleEastScope =
    user.countries.has('united arab emirates') ||
    user.countries.has('israel') ||
    tokens.has('uae') ||
    tokens.has('ae') ||
    tokens.has('dubai') ||
    tokens.has('abu dhabi') ||
    tokens.has('saudi arabia') ||
    tokens.has('riyadh') ||
    tokens.has('qatar') ||
    tokens.has('doha') ||
    tokens.has('middle east')
  if (hasMiddleEastScope) {
    return { siteNames: [...MIDDLE_EAST_BOARDS], reason: 'middle_east_scope' }
  }

  if (userAcceptsUnitedStates(user)) {
    return { siteNames: [...US_BOARDS], reason: 'us_scope' }
  }

  if (user.hasEuropeToken || user.hasEuToken || user.countries.has('portugal')) {
    return { siteNames: [...CORE_BOARDS], reason: 'europe_scope' }
  }

  // For global remote or unknown regions, keep broad mainstream boards but do
  // not include region-specialist boards unless the user explicitly targets
  // those regions. This avoids Naukri/Bayt noise for EU/global users.
  return { siteNames: [...US_BOARDS], reason: user.isAny ? 'anywhere_scope' : 'default_scope' }
}

function normaliseWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hasPhrase(haystack: string, phrase: string): boolean {
  const h = ` ${normaliseWords(haystack)} `
  const p = normaliseWords(phrase)
  return !!p && h.includes(` ${p} `)
}

function hasEuropeScope(locations: string[]): boolean {
  const user = parseUserLocations(locations)
  return user.hasEuropeToken || user.hasEuToken || user.countries.has('portugal')
}

function normaliseLocationToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/|]+/g, ' ')
    .replace(/[()[\]{}]+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s+/g, ' ')
}

function isEuropeRemoteScope(location: string): boolean {
  const loc = normaliseLocationToken(location)
  return ['europe', 'eu', 'emea', 'eea', 'remote europe', 'remote eu', 'remote emea'].includes(
    loc
  )
}

export function resolveJobsSearchRemoteFlag(input: {
  location: string
  remoteOnly?: boolean
}): boolean {
  if (input.remoteOnly) return true

  const loc = normaliseLocationToken(input.location)
  if (!loc) return false

  if (
    loc === 'remote' ||
    loc === 'anywhere' ||
    loc === 'worldwide' ||
    loc === 'global' ||
    loc === 'work from home' ||
    loc === 'wfh'
  ) {
    return true
  }

  if (loc.includes('remote')) return true

  return ['europe', 'eu', 'emea', 'eea', 'remote europe', 'remote eu', 'remote emea'].includes(
    loc
  )
}

function explicitJobsSearchCountryIndeed(): string | null {
  const raw = process.env.JOBS_SEARCH_COUNTRY_INDEED?.trim()
  return raw || null
}

function countryFromLocationToken(location: string): string | null {
  const loc = normaliseLocationToken(location)
  if (!loc) return null

  if (/\b(?:lisbon|porto|portugal)\b/.test(loc)) return 'Portugal'
  if (/\b(?:united states|usa|us|new york|california|san francisco|boston|chicago|seattle)\b/.test(loc)) {
    return 'USA'
  }
  if (/\bindia\b/.test(loc)) return 'India'
  if (/\b(?:united kingdom|uk|london|england|scotland|wales)\b/.test(loc)) return 'United Kingdom'
  if (/\bspain\b|\bmadrid\b|\bbarcelona\b/.test(loc)) return 'Spain'
  if (/\bfrance\b|\bparis\b/.test(loc)) return 'France'
  if (/\bgermany\b|\bberlin\b|\bmunich\b/.test(loc)) return 'Germany'
  if (/\bnetherlands\b|\bamsterdam\b/.test(loc)) return 'Netherlands'
  if (/\bireland\b|\bdublin\b/.test(loc)) return 'Ireland'
  if (/\b(?:united arab emirates|uae|dubai|abu dhabi)\b/.test(loc)) {
    return 'United Arab Emirates'
  }

  return null
}

export function resolveJobsSearchCountryIndeed(input: {
  location: string
  allLocations: string[]
}): { countryIndeed: string; reason: string } {
  const explicit = explicitJobsSearchCountryIndeed()
  if (explicit) return { countryIndeed: explicit, reason: 'env_override' }

  const direct = countryFromLocationToken(input.location)
  if (direct) return { countryIndeed: direct, reason: 'location_pass' }

  if (isEuropeRemoteScope(input.location)) {
    return { countryIndeed: 'Portugal', reason: 'europe_default' }
  }

  for (const location of input.allLocations) {
    const scoped = countryFromLocationToken(location)
    if (scoped) return { countryIndeed: scoped, reason: 'profile_scope' }
  }

  const user = parseUserLocations(input.allLocations)
  if (user.hasEuropeToken || user.hasEuToken) {
    return { countryIndeed: 'Portugal', reason: 'europe_default' }
  }

  return { countryIndeed: 'USA', reason: 'default' }
}

export function resolveJobsSearchLinkedinFetchDescription(siteNames: string[]): boolean {
  const raw = process.env.JOBS_SEARCH_LINKEDIN_DESC?.trim()
  if (raw === '0' || raw?.toLowerCase() === 'false') return false
  if (raw === '1' || raw?.toLowerCase() === 'true') return true
  return siteNames.some((name) => name.toLowerCase() === 'linkedin')
}

function providerLocationQualifier(input: {
  location: string
  allLocations: string[]
  remoteOnly?: boolean
}): string {
  const loc = input.location.trim()
  if (!loc) return input.remoteOnly ? 'remote' : ''
  const lower = loc.toLowerCase()

  if (lower === 'remote') {
    return hasEuropeScope(input.allLocations) ? 'remote Europe' : 'remote'
  }

  if (
    lower === 'europe' ||
    lower === 'eu' ||
    lower === 'emea' ||
    lower === 'remote europe' ||
    lower === 'remote eu' ||
    lower === 'remote emea'
  ) {
    return 'remote Europe'
  }

  if (lower === 'usa' || lower === 'us' || lower === 'united states') {
    return input.remoteOnly ? 'remote United States' : 'United States'
  }

  return input.remoteOnly && !hasPhrase(loc, 'remote') ? `remote ${loc}` : loc
}

export function buildProviderSearchQuery(input: {
  searchTerm: string
  location: string
  allLocations: string[]
  remoteOnly?: boolean
}): string {
  const base = input.searchTerm.trim()
  const qualifier = providerLocationQualifier(input)
  if (!base) return qualifier || 'remote'
  if (!qualifier || hasPhrase(base, qualifier)) return base

  if (qualifier.toLowerCase().startsWith('remote')) {
    const hasRemote = hasPhrase(base, 'remote')
    const rest = qualifier.replace(/^remote\s+/i, '').trim()
    if (hasRemote && rest && !hasPhrase(base, rest)) return `${base} ${rest}`.trim()
    if (hasRemote) return base
  }

  return `${base} ${qualifier}`.trim()
}

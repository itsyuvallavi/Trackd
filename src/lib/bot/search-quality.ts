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

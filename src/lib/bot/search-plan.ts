import {
  BOT_SEARCH_KEYWORD_OR_MAX,
  BOT_SEARCH_LOCATION_PASSES_MAX,
  BOT_SEARCH_PROVIDER_PASSES_MAX,
} from './search-constants'

export type BotSearchProviderPass = {
  searchTerm: string
  location: string
  termIndex: number
  locationIndex: number
}

export type BotSearchPassPlan = {
  searchTerms: string[]
  locations: string[]
  passes: BotSearchProviderPass[]
  totalPossiblePasses: number
  maxPasses: number
  droppedPasses: number
  capped: boolean
}

function trimmed(values: string[], max: number): string[] {
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, Math.max(0, max))
}

function nestedPasses(searchTerms: string[], locations: string[]): BotSearchProviderPass[] {
  const passes: BotSearchProviderPass[] = []
  for (let locationIndex = 0; locationIndex < locations.length; locationIndex++) {
    for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
      passes.push({
        searchTerm: searchTerms[termIndex],
        location: locations[locationIndex],
        termIndex,
        locationIndex,
      })
    }
  }
  return passes
}

function balancedCappedPasses(
  searchTerms: string[],
  locations: string[],
  maxPasses: number
): BotSearchProviderPass[] {
  const total = searchTerms.length * locations.length
  const wanted = Math.min(maxPasses, total)
  const passes: BotSearchProviderPass[] = []
  const seen = new Set<string>()

  for (let n = 0; passes.length < wanted && n < total * 2; n++) {
    const termIndex = n % searchTerms.length
    const locationIndex = (n + Math.floor(n / searchTerms.length)) % locations.length
    const key = `${termIndex}:${locationIndex}`
    if (seen.has(key)) continue
    seen.add(key)
    passes.push({
      searchTerm: searchTerms[termIndex],
      location: locations[locationIndex],
      termIndex,
      locationIndex,
    })
  }

  if (passes.length < wanted) {
    for (const pass of nestedPasses(searchTerms, locations)) {
      const key = `${pass.termIndex}:${pass.locationIndex}`
      if (seen.has(key)) continue
      seen.add(key)
      passes.push(pass)
      if (passes.length >= wanted) break
    }
  }

  return passes
}

export function buildBotSearchPassPlan(input: {
  keywords: string[]
  locations: string[]
  remoteOnly?: boolean
  keywordMax?: number
  locationMax?: number
  providerPassesMax?: number
}): BotSearchPassPlan {
  const keywordMax = input.keywordMax ?? BOT_SEARCH_KEYWORD_OR_MAX
  const locationMax = input.locationMax ?? BOT_SEARCH_LOCATION_PASSES_MAX
  const maxPasses = Math.max(1, input.providerPassesMax ?? BOT_SEARCH_PROVIDER_PASSES_MAX)

  const keywordSlice = trimmed(input.keywords, keywordMax)
  const searchTerms = keywordSlice.length > 0 ? keywordSlice : input.remoteOnly ? ['remote'] : ['']

  const rawLocs = trimmed(input.locations, locationMax)
  const locations = rawLocs.length > 0 ? rawLocs : ['Remote']

  const totalPossiblePasses = searchTerms.length * locations.length
  const capped = totalPossiblePasses > maxPasses
  const passes = capped
    ? balancedCappedPasses(searchTerms, locations, maxPasses)
    : nestedPasses(searchTerms, locations)

  return {
    searchTerms,
    locations,
    passes,
    totalPossiblePasses,
    maxPasses,
    droppedPasses: Math.max(0, totalPossiblePasses - passes.length),
    capped,
  }
}

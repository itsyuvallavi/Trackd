#!/usr/bin/env tsx

type SmokeRoute = {
  path: string
  expectedStatus: number
  maxMs?: number
  locationIncludes?: string
}

const baseUrl = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
const defaultMaxMs = Number.parseInt(process.env.SMOKE_ROUTE_BUDGET_MS ?? '1500', 10)

const routes: SmokeRoute[] = [
  { path: '/', expectedStatus: 200 },
  { path: '/signup', expectedStatus: 200 },
  { path: '/login', expectedStatus: 307, locationIncludes: '/?next=%2Fjobs' },
  { path: '/auth/callback', expectedStatus: 307, locationIncludes: '/login?error=missing_code' },
  { path: '/jobs', expectedStatus: 307, locationIncludes: '/login?next=%2Fjobs' },
  { path: '/api/bot/queue/count', expectedStatus: 401 },
  { path: '/api/notifications/count', expectedStatus: 401 },
  { path: '/api/auth/email/oauth/debug', expectedStatus: 200 },
]

async function checkRoute(route: SmokeRoute): Promise<string | null> {
  const url = `${baseUrl}${route.path}`
  const startedAt = performance.now()
  const maxMs = route.maxMs ?? defaultMaxMs
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), maxMs)
  let response: Response

  try {
    response = await fetch(url, { redirect: 'manual', signal: controller.signal })
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)
    if (error instanceof Error && error.name === 'AbortError') {
      return `${route.path}: expected <= ${maxMs}ms, request timed out after ${durationMs}ms`
    }
    return `${route.path}: request failed (${error instanceof Error ? error.message : String(error)})`
  } finally {
    clearTimeout(timeoutId)
  }

  const durationMs = Math.round(performance.now() - startedAt)
  const location = response.headers.get('location') ?? ''

  console.log(
    `${route.path.padEnd(32)} ${String(response.status).padEnd(3)} ${String(durationMs).padStart(4)}ms ${location}`,
  )

  if (response.status !== route.expectedStatus) {
    return `${route.path}: expected status ${route.expectedStatus}, got ${response.status}`
  }

  if (route.locationIncludes && !location.includes(route.locationIncludes)) {
    return `${route.path}: expected location to include "${route.locationIncludes}", got "${location}"`
  }

  if (durationMs > maxMs) {
    return `${route.path}: expected <= ${maxMs}ms, got ${durationMs}ms`
  }

  return null
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`)
  console.log(`Per-route budget: ${defaultMaxMs}ms`)

  const failures = (await Promise.all(routes.map(checkRoute))).filter(
    (failure): failure is string => Boolean(failure),
  )

  if (failures.length > 0) {
    console.error('\nSmoke route failures:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('\nSmoke routes passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

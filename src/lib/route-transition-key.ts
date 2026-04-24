/**
 * Key for <PageTransition/> so the route enter animation does not re-run
 * on drilldowns where only a dynamic [id] changes (e.g. /jobs → /jobs/:id).
 * Query strings do not affect pathname, so they never trigger a remount here.
 */
export function getRouteTransitionKey(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return '/'

  // Single dynamic segment: collapse to parent route name
  if (parts.length === 2) {
    const [first, second] = parts
    if (first === 'jobs' && second) return 'jobs'
    if (first === 'interview-prep' && second) return 'interview-prep'
  }

  return parts.join('/')
}

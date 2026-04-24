'use client'

import { usePathname } from 'next/navigation'
import { getRouteTransitionKey } from '@/lib/route-transition-key'

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Route enter animation: keyed by a stable route segment (see
 * `getRouteTransitionKey`) so drilldowns like /jobs → /jobs/:id do not
 * remount the whole subtree. Uses `trackd-route-enter` in
 * [globals.css](../../app/globals.css) at `--duration-route` (~120ms);
 * `prefers-reduced-motion` disables the animation in CSS.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const routeKey = getRouteTransitionKey(pathname)

  return (
    <div key={routeKey} className="trackd-route-enter">
      {children}
    </div>
  )
}

'use client'

import { usePathname } from 'next/navigation'

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Pathname-keyed route enter animation. Uses the `trackd-route-enter`
 * keyframe defined in [globals.css](../../app/globals.css), which
 * honors `prefers-reduced-motion` via the global @media block.
 *
 * Kept framer-motion-free so this sits on the critical authed bundle
 * without dragging in the animation runtime.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="trackd-route-enter">
      {children}
    </div>
  )
}

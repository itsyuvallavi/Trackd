import { useEffect, useState } from 'react'

/**
 * Central motion tokens for the Trackd redesign.
 *
 * These mirror the CSS custom properties declared in `globals.css`
 * (`--ease-ios`, `--duration-*`, etc.) so that JS-driven animations
 * via framer-motion stay in sync with the CSS-only ones.
 *
 * All durations are in seconds (framer-motion convention).
 */

export const easings = {
  ios: [0.32, 0.72, 0, 1] as [number, number, number, number],
  emphasized: [0.2, 0, 0, 1] as [number, number, number, number],
  snappy: [0.16, 1, 0.3, 1] as [number, number, number, number],
  standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
}

export const durations = {
  xs: 0.12,
  sm: 0.18,
  md: 0.26,
  lg: 0.38,
  xl: 0.56,
} as const

/** Spring presets. Use `type: 'spring'` with these values. */
export const springs = {
  /** Default UI spring — good for buttons, pills, small transforms. */
  default: { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 },
  /** Softer spring — good for layout animations, cards, drawers. */
  soft: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1 },
  /** Snappy spring — good for drag release, hero moments. */
  snappy: { type: 'spring' as const, stiffness: 520, damping: 36, mass: 0.8 },
}

/** Common transition presets ready to be spread into `transition={...}`. */
export const transitions = {
  fade: { duration: durations.md, ease: easings.ios },
  slide: { duration: durations.lg, ease: easings.snappy },
  emphasized: { duration: durations.lg, ease: easings.emphasized },
}

/**
 * React hook that reports whether the user has requested reduced motion
 * (via `prefers-reduced-motion: reduce`). Use this to gate optional
 * framer-motion animations.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

/** Tiny helper: picks `whenMotion` when motion is allowed, else `whenReduced`. */
export function withMotion<T>(reduced: boolean, whenMotion: T, whenReduced: T): T {
  return reduced ? whenReduced : whenMotion
}

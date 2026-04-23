import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Glass primitives for the Trackd redesign.
 *
 * These wrap the `.glass*` utility family in [globals.css](../../app/globals.css)
 * with sensible defaults (radius, padding, shadow) and a small set of
 * variants. Prefer these over ad-hoc `backdrop-blur` classes.
 *
 * Do not nest glass inside glass, and do not apply to long virtualized
 * lists — backdrop-filter is GPU-expensive.
 */

type GlassVariant = 'default' | 'strong' | 'subtle' | 'nav'

const glassClass: Record<GlassVariant, string> = {
  default: 'glass',
  strong: 'glass glass-strong',
  subtle: 'glass glass-subtle',
  nav: 'glass glass-nav',
}

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant
  as?: 'div' | 'section' | 'aside' | 'nav' | 'header' | 'footer' | 'main'
}

/** Full-bleed glass surface for page-level panels. */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { className, variant = 'default', as = 'div', ...rest },
    ref
  ) {
    const Component = as as keyof React.JSX.IntrinsicElements
    return React.createElement(Component, {
      ref,
      className: cn(glassClass[variant], className),
      ...rest,
    })
  }
)

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant
  interactive?: boolean
}

/** Card-sized glass surface with padding and optional hover lift. */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard(
    { className, variant = 'default', interactive = false, ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          glassClass[variant],
          'p-4 md:p-5',
          interactive &&
            'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-18px_oklch(0.18_0.015_264_/_0.25)]',
          className
        )}
        {...rest}
      />
    )
  }
)

interface GlassPillProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant
}

/** Capsule-shaped glass chip for status, counts, badges. */
export const GlassPill = React.forwardRef<HTMLDivElement, GlassPillProps>(
  function GlassPill({ className, variant = 'subtle', ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          glassClass[variant],
          'rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5',
          className
        )}
        {...rest}
      />
    )
  }
)

interface GlassToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant
}

/** Horizontal glass container meant for floating chrome (top bars, menus). */
export const GlassToolbar = React.forwardRef<HTMLDivElement, GlassToolbarProps>(
  function GlassToolbar({ className, variant = 'nav', ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          glassClass[variant],
          'rounded-full px-3 py-2 flex items-center gap-2',
          className
        )}
        {...rest}
      />
    )
  }
)

/**
 * Background aurora — ambient color-wash behind glass panels.
 * Render inside a relatively-positioned, overflow-hidden parent.
 */
export function Aurora({ className }: { className?: string }) {
  return <div aria-hidden className={cn('aurora', className)} />
}

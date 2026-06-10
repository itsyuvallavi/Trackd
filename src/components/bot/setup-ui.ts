/** Shared control styles for /bot/setup — one visual language across the page. */

export const setupLabelClass = 'text-sm font-medium text-foreground/90'

export const setupSectionTitleClass =
  'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

/** Vertical gap between a label row and its control. */
export const setupFieldGroupClass = 'flex flex-col gap-3'

/** Vertical gap between stacked field groups. */
export const setupStackClass = 'space-y-5'

export const setupFieldClass =
  'h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors'

export const setupSelectClass =
  'h-9 w-full appearance-none rounded-md border border-border bg-background pl-3 pr-8 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors'

export const setupSelectCompactClass =
  'h-8 w-full appearance-none rounded-md border border-border bg-background pl-2.5 pr-7 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors disabled:opacity-50'

export const setupInsetClass =
  'flex h-9 items-center gap-2 rounded-md border border-border bg-muted/25 px-3 text-sm shadow-sm'

export const setupBtnSecondaryClass =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors disabled:opacity-40'

export const setupFilePickerClass =
  'flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground shadow-sm hover:bg-muted transition-colors'

export const setupBtnPrimaryClass =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50'

export const setupTagClass =
  'inline-flex h-7 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 text-xs font-medium'

export const setupGridClass = 'grid grid-cols-2 gap-3'

export const setupRowClass = 'flex items-center gap-2'

export const setupDetailsSummaryClass =
  'flex h-8 cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden'

export const setupPanelClass =
  'overflow-hidden rounded-lg border border-border bg-card shadow-sm'

export const setupPanelBodyClass = 'p-5'

/**
 * Labels for **`Job.importSource`** (which API/integration returned the listing).
 * `Job.source` is only a coarse enum (often misused for bot rows); never treat it alone as “the API.”
 */

import type { JobSource } from '@prisma/client'
import { SOURCE_LABELS } from '@/lib/constants'

/** From NOTE created by bot save: `Bot found via jobs_search_api · AI score …` */
export function slugFromBotFoundNote(description: string | null | undefined): string | null {
  if (!description) return null
  const m = description.match(/^Bot found via ([A-Za-z0-9_]+)/)
  return m?.[1] ? m[1].toLowerCase() : null
}

export function inferredImportSlugFromActivities(
  activities: { type: string; description: string | null }[] | undefined
): string | null {
  if (!activities?.length) return null
  for (const a of activities) {
    if (a.type !== 'NOTE') continue
    const slug = slugFromBotFoundNote(a.description)
    if (slug) return slug
  }
  return null
}

/** `Job.importSource` slug → RapidAPI product / adapter name shown in UI. */
const API_PRODUCT_LABELS: Record<string, string> = {
  jsearch: 'JSearch (RapidAPI)',
  jobs_search_api: 'Jobs Search API (RapidAPI)',
  linkedin: 'LinkedIn Jobs Search (RapidAPI)',
  linkedin_ljs: 'LinkedIn Job Search (RapidAPI)',
  glassdoor_rt: 'Glassdoor Real-Time (RapidAPI)',
}

/** When `importSource === jobs_search_api`, `importJobBoard` is the job-site name for that row. */
const JOB_BOARD_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  glassdoor: 'Glassdoor',
  zip_recruiter: 'ZipRecruiter',
  naukri: 'Naukri',
  bayt: 'Bayt',
}

function humanizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function isBotTagged(tags: string[] | undefined): boolean {
  if (!tags?.length) return false
  return tags.some((t) => t === 'bot-found' || t === 'bot-approved')
}

export function jobSourceDisplayName(
  importSource: string | null | undefined,
  jobSource: JobSource,
  importJobBoard?: string | null | undefined,
  opts?: {
    tags?: string[]
    activities?: { type: string; description: string | null }[]
  }
): string {
  const inferred = inferredImportSlugFromActivities(opts?.activities)
  const raw = (importSource?.trim() || inferred)?.trim()

  if (raw) {
    const key = raw.toLowerCase()
    let label = API_PRODUCT_LABELS[key] ?? humanizeSlug(raw)

    if (key === 'jobs_search_api') {
      const bb = importJobBoard?.trim()
      if (bb) {
        const bk = bb.toLowerCase()
        const boardPretty = JOB_BOARD_LABELS[bk] ?? humanizeSlug(bb)
        label = `${label} · ${boardPretty}`
      }
    }

    return label
  }

  const tags = opts?.tags ?? []
  const taggedBot = isBotTagged(tags)

  if (jobSource === 'MANUAL') return SOURCE_LABELS.MANUAL

  // Bot pipeline should persist importSource; enum Job.source is a legacy channel hint, not the API name.
  if (taggedBot || jobSource === 'BOT') {
    return 'API not recorded'
  }

  return `Manual · ${SOURCE_LABELS[jobSource]}`
}

export type ATSType =
  | 'greenhouse'
  | 'lever'
  | 'indeed'
  | 'workday'
  | 'linkedin_easy'
  | 'direct'

export function detectATS(url: string): ATSType {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()

    if (host.includes('greenhouse.io')) return 'greenhouse'
    if (host.includes('lever.co')) return 'lever'
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) return 'workday'
    if (host.includes('indeed.com')) return 'indeed'
    if (host.includes('linkedin.com')) return 'linkedin_easy'
  } catch {
    // invalid URL — fall through
  }
  return 'direct'
}

export const ATS_LABELS: Record<ATSType, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  indeed: 'Indeed',
  workday: 'Workday',
  linkedin_easy: 'LinkedIn Easy Apply',
  direct: 'Direct Application',
}

/**
 * Generic / direct site adapter.
 * Heuristic-based form filling for unknown job application pages.
 * Looks for common field patterns by name/placeholder/label.
 */

import type { Page } from 'playwright-core'
import { answerCustomField } from '../field-filler'
import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

interface JobCtx {
  title: string
  company: string
  description?: string | null
}

interface FillResult {
  fieldsFilledCount: number
  skippedFields: string[]
  screenshot: Buffer
}

const NAME_PATTERNS = ['name', 'full_name', 'fullname', 'full-name']
const FIRST_PATTERNS = ['first_name', 'firstname', 'first-name', 'fname', 'given_name']
const LAST_PATTERNS = ['last_name', 'lastname', 'last-name', 'lname', 'surname', 'family_name']
const EMAIL_PATTERNS = ['email', 'email_address', 'e-mail']
const PHONE_PATTERNS = ['phone', 'phone_number', 'telephone', 'mobile', 'cell']
const LINKEDIN_PATTERNS = ['linkedin', 'linkedin_url', 'linkedin_profile']
const GITHUB_PATTERNS = ['github', 'github_url', 'github_profile']
const WEBSITE_PATTERNS = ['website', 'portfolio', 'personal_url', 'url']
const LOCATION_PATTERNS = ['location', 'city', 'address', 'residence']

function matches(attr: string, patterns: string[]): boolean {
  const a = attr.toLowerCase().replace(/[-_\s]/g, '')
  return patterns.some((p) => a.includes(p.replace(/[-_]/g, '')))
}

async function smartFill(
  page: Page,
  patterns: string[],
  value: string | null | undefined
): Promise<boolean> {
  if (!value) return false
  try {
    const inputs = await page.$$('input[type="text"], input[type="email"], input[type="tel"], input:not([type])')
    for (const input of inputs) {
      const id = (await input.getAttribute('id')) ?? ''
      const name = (await input.getAttribute('name')) ?? ''
      const placeholder = (await input.getAttribute('placeholder')) ?? ''
      const ariaLabel = (await input.getAttribute('aria-label')) ?? ''

      if (
        matches(id, patterns) ||
        matches(name, patterns) ||
        matches(placeholder, patterns) ||
        matches(ariaLabel, patterns)
      ) {
        const isVisible = await input.isVisible().catch(() => false)
        if (isVisible) {
          await input.fill(value)
          return true
        }
      }
    }
  } catch {}
  return false
}

export async function fillGenericApplication(
  page: Page,
  url: string,
  profile: ApplicationProfile | null,
  resume: ResumeStructuredData | null,
  resumeFilePath: string | null,
  job: JobCtx
): Promise<FillResult> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(2000)

  let fieldsFilledCount = 0
  const skippedFields: string[] = []

  // Fill name fields
  if (resume?.name) {
    const parts = resume.name.trim().split(' ')
    const firstName = parts[0] ?? ''
    const lastName = parts.slice(1).join(' ') || firstName

    if (await smartFill(page, NAME_PATTERNS, resume.name)) fieldsFilledCount++
    if (await smartFill(page, FIRST_PATTERNS, firstName)) fieldsFilledCount++
    if (await smartFill(page, LAST_PATTERNS, lastName)) fieldsFilledCount++
  }

  if (await smartFill(page, EMAIL_PATTERNS, resume?.email ?? null)) fieldsFilledCount++
  if (await smartFill(page, PHONE_PATTERNS, profile?.phone ?? null)) fieldsFilledCount++
  if (await smartFill(page, LINKEDIN_PATTERNS, profile?.linkedinUrl ?? null)) fieldsFilledCount++
  if (await smartFill(page, GITHUB_PATTERNS, profile?.githubUrl ?? null)) fieldsFilledCount++
  if (await smartFill(page, WEBSITE_PATTERNS, profile?.portfolioUrl ?? null)) fieldsFilledCount++
  if (await smartFill(page, LOCATION_PATTERNS, profile?.city ? `${profile.city}, ${profile.state ?? ''}`.trim() : null)) fieldsFilledCount++

  // Resume upload
  if (resumeFilePath) {
    try {
      const fileInputs = await page.$$('input[type="file"]')
      for (const input of fileInputs) {
        const accept = await input.getAttribute('accept') ?? ''
        const isResume = accept.includes('pdf') || accept.includes('doc') || !accept
        if (isResume) {
          await input.setInputFiles(resumeFilePath)
          fieldsFilledCount++
          break
        }
      }
    } catch {}
  }

  // Try to fill textareas (cover letter, "tell us about yourself", etc.)
  try {
    const textareas = await page.$$('textarea')
    for (const ta of textareas) {
      const id = (await ta.getAttribute('id')) ?? ''
      const name = (await ta.getAttribute('name')) ?? ''
      const placeholder = (await ta.getAttribute('placeholder')) ?? ''
      const label = `${id} ${name} ${placeholder}`.toLowerCase()

      const isVisible = await ta.isVisible().catch(() => false)
      if (!isVisible) continue

      const fieldLabel = label || 'cover letter / additional information'
      const answer = await answerCustomField(
        { label: fieldLabel, type: 'textarea' },
        job,
        profile,
        resume
      ).catch(() => '')

      if (answer) {
        await ta.fill(answer)
        fieldsFilledCount++
      }
    }
  } catch {}

  await page.waitForTimeout(500)
  const screenshot = await page.screenshot({ fullPage: true })

  return { fieldsFilledCount, skippedFields, screenshot }
}

export async function submitGenericApplication(page: Page): Promise<void> {
  const submitBtn = page.locator(
    'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply"), button:has-text("Send application")'
  ).last()
  await submitBtn.click({ timeout: 5_000 })
  await page.waitForTimeout(3000)
}

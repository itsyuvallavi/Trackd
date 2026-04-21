/**
 * Greenhouse ATS adapter.
 * Handles boards.greenhouse.io application forms.
 */

import type { Page } from 'playwright-core'
import { logApply, truncate } from '../apply-log'
import { answerCustomField } from '../field-filler'
import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

export interface FillResult {
  fieldsFilledCount: number
  skippedFields: string[]
  screenshot: Buffer
}

interface JobCtx {
  title: string
  company: string
  description?: string | null
}

export async function fillGreenhouseApplication(
  page: Page,
  url: string,
  profile: ApplicationProfile | null,
  resume: ResumeStructuredData | null,
  resumeFilePath: string | null,
  job: JobCtx
): Promise<FillResult> {
  logApply('greenhouse_start', { url: truncate(url, 120), job: truncate(`${job.title} @ ${job.company}`, 80) })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(1500)

  let fieldsFilledCount = 0
  const skippedFields: string[] = []

  // -- Standard fields --
  const tryFill = async (selector: string, value: string | null | undefined) => {
    if (!value) return false
    try {
      const el = page.locator(selector).first()
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(value)
        fieldsFilledCount++
        return true
      }
    } catch {}
    return false
  }

  // Name fields (Greenhouse uses first_name / last_name)
  if (resume?.name) {
    const parts = resume.name.trim().split(' ')
    const firstName = parts[0] ?? ''
    const lastName = parts.slice(1).join(' ') || (parts[0] ?? '')
    await tryFill('#first_name', firstName)
    await tryFill('#last_name', lastName)
  }

  await tryFill('#email', resume?.email ?? null)
  await tryFill('#phone', profile?.phone ?? null)
  await tryFill('#job_application_location', profile?.city ? `${profile.city}, ${profile.state ?? ''}`.trim() : null)

  // LinkedIn / GitHub / Portfolio
  await tryFill('input[name*="linkedin"], input[id*="linkedin"]', profile?.linkedinUrl ?? null)
  await tryFill('input[name*="github"], input[id*="github"]', profile?.githubUrl ?? null)
  await tryFill('input[name*="website"], input[id*="website"], input[name*="portfolio"]', profile?.portfolioUrl ?? null)

  // Resume upload
  if (resumeFilePath) {
    try {
      const resumeInput = page.locator('input[type="file"]').first()
      if (await resumeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await resumeInput.setInputFiles(resumeFilePath)
        fieldsFilledCount++
      }
    } catch {}
  }

  // -- Custom questions --
  // Greenhouse renders custom fields as divs with labels + inputs
  const customFields = await page.$$eval(
    '.field, [class*="custom-field"], [class*="question"]',
    (els) =>
      els.map((el) => {
        const label = el.querySelector('label')?.textContent?.trim() ?? ''
        const input = el.querySelector('input, textarea, select')
        const tag = input?.tagName.toLowerCase() ?? 'text'
        const type = tag === 'select'
          ? 'select'
          : tag === 'textarea'
            ? 'textarea'
            : 'text'
        const options =
          tag === 'select'
            ? Array.from((input as HTMLSelectElement)?.options ?? []).map((o) => o.text)
            : []
        const id = input?.id ?? ''
        const name = (input as HTMLInputElement)?.name ?? ''
        return { label, type, options, id, name }
      }).filter((f) => f.label && (f.id || f.name))
  )

  for (const field of customFields) {
    // Skip standard fields we already filled
    const isStandard = ['first_name', 'last_name', 'email', 'phone'].some(
      (s) => field.id.includes(s) || field.name.includes(s)
    )
    if (isStandard) continue

    try {
      const answer = await answerCustomField(
        { label: field.label, type: field.type as 'text' | 'textarea' | 'select', options: field.options },
        job,
        profile,
        resume
      )

      if (!answer) {
        skippedFields.push(field.label)
        continue
      }

      if (field.type === 'select') {
        const sel = page.locator(`select#${field.id}, select[name="${field.name}"]`).first()
        await sel.selectOption({ label: answer }).catch(() => sel.selectOption(answer))
      } else {
        const sel = page.locator(
          `#${field.id}${field.name ? `, [name="${field.name}"]` : ''}`
        ).first()
        await sel.fill(answer)
      }
      fieldsFilledCount++
    } catch {
      skippedFields.push(field.label)
    }
  }

  // Screenshot
  await page.waitForTimeout(500)
  const screenshot = await page.screenshot({ fullPage: true })

  logApply('greenhouse_done', { fieldsFilledCount, skippedCount: skippedFields.length })
  return { fieldsFilledCount, skippedFields, screenshot }
}

export async function submitGreenhouseApplication(page: Page): Promise<void> {
  logApply('greenhouse_submit_click', {})
  // Greenhouse submit button
  const submitBtn = page.locator(
    'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")'
  ).last()
  await submitBtn.click()
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
}

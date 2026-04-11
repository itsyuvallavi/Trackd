/**
 * Lever ATS adapter.
 * Handles jobs.lever.co application forms.
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

export async function fillLeverApplication(
  page: Page,
  url: string,
  profile: ApplicationProfile | null,
  resume: ResumeStructuredData | null,
  resumeFilePath: string | null,
  job: JobCtx
): Promise<FillResult> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(1500)

  let fieldsFilledCount = 0
  const skippedFields: string[] = []

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

  // Lever standard fields
  if (resume?.name) {
    const parts = resume.name.trim().split(' ')
    await tryFill('input[name="name"]', resume.name)
    // Some Lever forms use separate first/last
    await tryFill('input[name="first_name"]', parts[0] ?? '')
    await tryFill('input[name="last_name"]', parts.slice(1).join(' ') || (parts[0] ?? ''))
  }

  await tryFill('input[name="email"]', resume?.email ?? null)
  await tryFill('input[name="phone"]', profile?.phone ?? null)
  await tryFill('input[name="org"]', null) // current company — leave blank
  await tryFill('input[name="location"]', profile?.city ? `${profile.city}, ${profile.state ?? ''}`.trim() : null)

  // Social URLs
  await tryFill('input[name="urls[LinkedIn]"], input[placeholder*="LinkedIn"]', profile?.linkedinUrl ?? null)
  await tryFill('input[name="urls[GitHub]"], input[placeholder*="GitHub"]', profile?.githubUrl ?? null)
  await tryFill('input[name="urls[Portfolio]"], input[placeholder*="Portfolio"], input[name="urls[Other]"]', profile?.portfolioUrl ?? null)

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

  // Lever custom questions — rendered as <li class="application-question">
  const customFields = await page.$$eval(
    '.application-question, [class*="question"]',
    (els) =>
      els.map((el) => {
        const label = el.querySelector('label')?.textContent?.trim() ?? ''
        const textarea = el.querySelector('textarea')
        const input = el.querySelector('input')
        const select = el.querySelector('select')
        const type = textarea ? 'textarea' : select ? 'select' : 'text'
        const options = select
          ? Array.from(select.options).map((o) => o.text)
          : []
        const id = (textarea ?? input ?? select)?.id ?? ''
        const name = (textarea ?? input ?? (select as unknown as HTMLInputElement))?.name ?? ''
        return { label, type, options, id, name }
      }).filter((f) => f.label)
  )

  for (const field of customFields) {
    const isStandard = ['name', 'email', 'phone', 'location'].includes(field.name)
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
        const sel = page.locator(`select#${field.id}`).first()
        await sel.selectOption({ label: answer }).catch(() => sel.selectOption(answer))
      } else {
        const el = field.id
          ? page.locator(`#${field.id}`).first()
          : page.locator(`[name="${field.name}"]`).first()
        await el.fill(answer)
      }
      fieldsFilledCount++
    } catch {
      skippedFields.push(field.label)
    }
  }

  await page.waitForTimeout(500)
  const screenshot = await page.screenshot({ fullPage: true })

  return { fieldsFilledCount, skippedFields, screenshot }
}

export async function submitLeverApplication(page: Page): Promise<void> {
  const submitBtn = page.locator(
    'button[type="submit"], button:has-text("Submit application"), button:has-text("Apply")'
  ).last()
  await submitBtn.click()
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})
}

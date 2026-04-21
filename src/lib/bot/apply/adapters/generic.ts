/**
 * Generic / direct site adapter.
 * Page-driven flow: scan DOM → LLM plan (knowledge bank) → execute → AI sweep for leftovers.
 * Avoids ATS-specific branching; the model chooses actions from scanned controls.
 */

import type { Page } from 'playwright-core'
import { answerCustomField } from '../field-filler'
import {
  executeFormPlan,
  planFormActions,
  scanApplicationPage,
  sweepEmptyFieldsWithAI,
} from '../form-intelligence'
import { buildApplicationKnowledgeBank, type ApplicationJobContext } from '../knowledge-bank'
import { logApply, truncate } from '../apply-log'
import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'

interface FillResult {
  fieldsFilledCount: number
  skippedFields: string[]
  screenshot: Buffer
}

/** Extra rounds give the LLM time to click Apply / Continue links, then fill after DOM updates. */
const PLAN_ROUNDS = 4

export async function fillGenericApplication(
  page: Page,
  url: string,
  profile: ApplicationProfile | null,
  resume: ResumeStructuredData | null,
  resumeFilePath: string | null,
  job: ApplicationJobContext
): Promise<FillResult> {
  const jobCtx: ApplicationJobContext = {
    ...job,
    jobUrl: url,
    applicationEmail:
      job.applicationEmail?.trim() ||
      profile?.applicationEmail?.trim() ||
      resume?.email?.trim() ||
      null,
  }

  logApply('generic_start', {
    url: truncate(url, 120),
    job: truncate(`${jobCtx.title} @ ${jobCtx.company}`, 80),
    hasResumeFile: Boolean(resumeFilePath),
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(2500)

  const skippedFields: string[] = []
  let fieldsFilledCount = 0

  const knowledgeBank = buildApplicationKnowledgeBank(jobCtx, profile, resume)

  for (let round = 0; round < PLAN_ROUNDS; round++) {
    const scan = await scanApplicationPage(page)
    logApply('generic_scan', { round, controls: scan.length })
    if (scan.length === 0) {
      skippedFields.push('no_controls_scanned')
      break
    }

    const plan = await planFormActions(scan, knowledgeBank, jobCtx)
    if (!plan.actions.length) {
      logApply('generic_round_skip', { round, reason: 'no_planned_actions' })
      break
    }

    const { ok, failed } = await executeFormPlan(page, plan, scan, resumeFilePath)
    fieldsFilledCount += ok
    if (failed > 0) skippedFields.push(`round_${round}_failed_${failed}`)
    logApply('generic_round_done', { round, ok, failed, fieldsFilledCount })
  }

  const scanFinal = await scanApplicationPage(page)
  logApply('generic_scan_final', { controls: scanFinal.length })
  const swept = await sweepEmptyFieldsWithAI(page, scanFinal, (label, type) =>
    answerCustomField({ label, type }, jobCtx, profile, resume)
  )
  fieldsFilledCount += swept

  await page.waitForTimeout(500)
  const screenshot = await page.screenshot({ fullPage: true })

  logApply('generic_done', { fieldsFilledCount, skippedFields, screenshotBytes: screenshot.length })
  return { fieldsFilledCount, skippedFields, screenshot }
}

export async function submitGenericApplication(page: Page): Promise<void> {
  logApply('generic_submit_click', { adapter: 'generic' })
  const submitBtn = page
    .locator(
      [
        '[data-testid="submit-application-form-button"]',
        'button[type="submit"]:has-text("Send")',
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Apply")',
        'button:has-text("Send application")',
      ].join(', ')
    )
    .first()
  await submitBtn.click({ timeout: 5_000 })
  await page.waitForTimeout(3000)
}

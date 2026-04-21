#!/usr/bin/env bun
/**
 * Local headless demo: fills the TransPerfect Recruitee application form
 * (PDF upload, cover letter textarea, Yes/No radios, technologies paragraph).
 * Does not click Send.
 *
 *   bun run scripts/demo-recruitee-transperfect.ts
 *
 * Requires Google Chrome installed locally (Playwright `channel: 'chrome'`),
 * or set `CHROMIUM_EXECUTABLE` to a Chromium/Chrome binary.
 *
 * Output: scripts/fixtures/transperfect-recruitee-demo-filled.png (full page)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const FORM_URL =
  'https://transperfect.recruitee.com/o/junior-frontend-engineer-1/c/new'

const TECH_STACK_PARAGRAPH = `My core stack is TypeScript and JavaScript on the frontend with React and Next.js, styled with Tailwind CSS and shadcn/ui. On the backend I work with Node.js, REST APIs, PostgreSQL, Prisma, and Supabase, and I've shipped products using Firebase (Auth, Firestore, and related services). For mobile I use Flutter and Dart. I deploy with Vercel and Netlify and use Git / GitHub daily.`

const COVER_LETTER = `I am excited to apply for the Junior Frontend Engineer role at TransPerfect. I enjoy building polished, maintainable UIs with React and Next.js, collaborating across disciplines, and shipping iteratively with strong attention to detail. I would welcome the opportunity to contribute to your team and grow with the product.`

const DEMO = {
  fullName: 'Demo Applicant',
  email: 'demo.applicant@example.com',
  phone: '+1 555 0100',
  linkedIn: 'https://www.linkedin.com/in/example-demo-profile',
  yearsExperience: '5',
  salaryEurGross: '75000',
  radios: [
    { contains: 'based in Portugal', value: 'false' as const },
    { contains: 'Lisbon', value: 'false' as const },
    { contains: 'sponsorship', value: 'false' as const },
    { contains: 'English', value: 'true' as const },
  ],
}

const __dirname = dirname(fileURLToPath(import.meta.url))

async function launchBrowser() {
  const exe = process.env.CHROMIUM_EXECUTABLE?.trim()
  if (exe) {
    return chromium.launch({ headless: true, executablePath: exe })
  }
  try {
    return await chromium.launch({ headless: true, channel: 'chrome' })
  } catch (e1) {
    try {
      return await chromium.launch({ headless: true, channel: 'chrome-beta' })
    } catch (e2) {
      throw new Error(
        'Could not launch Chrome. Install Google Chrome or set CHROMIUM_EXECUTABLE to a Chromium binary.',
        { cause: e2 ?? e1 }
      )
    }
  }
}

async function main() {
  const pdfPath = join(__dirname, 'fixtures', 'minimal-resume.pdf')
  const outPng = join(__dirname, 'fixtures', 'transperfect-recruitee-demo-filled.png')

  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(FORM_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(2500)

  await page.locator('input[name="candidate.name"]').fill(DEMO.fullName)
  await page.locator('input[name="candidate.email"]').fill(DEMO.email)
  await page.locator('input[name="candidate.phone"]').fill(DEMO.phone)

  await page.locator('input[name="candidate.cv"]').setInputFiles(pdfPath)

  const switchBtn = page.locator('button[data-cy="cover-letter-switch-button"]')
  if (await switchBtn.isVisible().catch(() => false)) await switchBtn.click()
  await page.waitForTimeout(700)

  const coverLoc = page.locator('textarea[name="candidate.coverLetter"]')
  await coverLoc.waitFor({ state: 'visible', timeout: 15_000 })
  await coverLoc.fill(COVER_LETTER)

  await page.locator('input[name="candidate.openQuestionAnswers.6555003.content"]').fill(DEMO.linkedIn)

  await page.locator('textarea[name="candidate.openQuestionAnswers.6017485.content"]').fill(TECH_STACK_PARAGRAPH)

  await page.locator('input[name="candidate.openQuestionAnswers.6017486.content"]').fill(DEMO.yearsExperience)
  await page.locator('input[name="candidate.openQuestionAnswers.6017487.content"]').fill(DEMO.salaryEurGross)

  for (const { contains, value } of DEMO.radios) {
    await page.evaluate(
      ({ snippet, v }) => {
        const legends = [...document.querySelectorAll('fieldset legend')]
        const leg = legends.find((l) => (l.textContent ?? '').includes(snippet))
        const fs = leg?.closest('fieldset')
        const inp = fs?.querySelector(`input[type="radio"][value="${v}"]`) as HTMLInputElement | null
        inp?.click()
      },
      { snippet: contains, v: value }
    )
    await page.waitForTimeout(120)
  }

  await mkdir(join(__dirname, 'fixtures'), { recursive: true })
  const buf = await page.screenshot({ fullPage: true, type: 'png' })
  await writeFile(outPng, buf)

  console.log(`Wrote ${outPng} (${buf.length} bytes). Form was not submitted.`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

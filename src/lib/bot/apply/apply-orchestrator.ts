/**
 * Application orchestrator.
 * Coordinates: ATS detection → resume fetch → browser session → form fill → screenshot upload.
 */

import { createClient } from '@supabase/supabase-js'
import { detectATS } from './ats-detector'
import { withBrowser } from './browser'
import { fillGreenhouseApplication, submitGreenhouseApplication } from './adapters/greenhouse'
import { fillLeverApplication, submitLeverApplication } from './adapters/lever'
import { fillGenericApplication, submitGenericApplication } from './adapters/generic'
import { prisma } from '@/lib/prisma'
import { pickResumeForJob } from '@/lib/bot/resume/parser'
import type { ApplicationProfile } from '@prisma/client'
import type { ResumeStructuredData } from '@/lib/bot/resume/types'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function uploadScreenshot(
  userId: string,
  attemptId: string,
  index: number,
  buffer: Buffer
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const filePath = `bot-screenshots/${userId}/${attemptId}/${index}.png`

  const { error } = await supabase.storage
    .from('resume')
    .upload(filePath, buffer, { contentType: 'image/png', upsert: true })

  if (error) throw new Error(`Screenshot upload failed: ${error.message}`)

  const { data } = supabase.storage.from('resume').getPublicUrl(filePath)
  return data.publicUrl
}

async function downloadResumeToDisk(fileUrl: string): Promise<string | null> {
  try {
    const res = await fetch(fileUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const tmpPath = path.join(os.tmpdir(), `resume-${Date.now()}.pdf`)
    fs.writeFileSync(tmpPath, buffer)
    return tmpPath
  } catch {
    return null
  }
}

export interface ApplyResult {
  success: boolean
  screenshotUrls: string[]
  fieldsFilledCount: number
  skippedFields: string[]
  atsType: string
  error?: string
}

export async function runApplicationFill(
  attemptId: string,
  userId: string,
  jobId: string
): Promise<ApplyResult> {
  // Update attempt to "filling"
  await prisma.applicationAttempt.update({
    where: { id: attemptId },
    data: { status: 'filling' },
  })

  let screenshotUrls: string[] = []

  try {
    // Load job
    const job = await prisma.job.findFirstOrThrow({
      where: { id: jobId, userId },
      select: { title: true, company: true, url: true, botReasoning: true },
    })

    if (!job.url) throw new Error('Job has no URL')

    const atsType = detectATS(job.url)

    // Load application profile
    const profile = await prisma.applicationProfile.findUnique({ where: { userId } })

    // Load best matching resume
    let resume: ResumeStructuredData | null = null
    let resumeFileUrl: string | null = null

    const resumes = await prisma.botResume.findMany({
      where: { userId },
      select: { id: true, label: true, matchKeywords: true, isDefault: true, structuredData: true, fileUrl: true },
    })

    if (resumes.length > 0) {
      const bestId = pickResumeForJob(resumes, job.title)
      const matched = resumes.find((r) => r.id === bestId)
      if (matched) {
        resume = matched.structuredData as unknown as ResumeStructuredData
        resumeFileUrl = matched.fileUrl
      }
    }

    // Download resume PDF to temp disk (browser needs a local file path)
    const resumeFilePath = resumeFileUrl ? await downloadResumeToDisk(resumeFileUrl) : null

    const jobCtx = { title: job.title, company: job.company, description: job.botReasoning }

    const { screenshot, fieldsFilledCount, skippedFields } = await withBrowser(async (page) => {
      switch (atsType) {
        case 'greenhouse':
          return fillGreenhouseApplication(page, job.url!, profile, resume, resumeFilePath, jobCtx)
        case 'lever':
          return fillLeverApplication(page, job.url!, profile, resume, resumeFilePath, jobCtx)
        default:
          return fillGenericApplication(page, job.url!, profile, resume, resumeFilePath, jobCtx)
      }
    })

    // Clean up temp file
    if (resumeFilePath) {
      try { fs.unlinkSync(resumeFilePath) } catch {}
    }

    // Upload screenshot
    const screenshotUrl = await uploadScreenshot(userId, attemptId, 0, screenshot)
    screenshotUrls = [screenshotUrl]

    // Save result to DB
    await prisma.applicationAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'awaiting_review',
        atsType,
        screenshots: screenshotUrls,
        formData: { fieldsFilledCount, skippedFields },
      },
    })

    return { success: true, screenshotUrls, fieldsFilledCount, skippedFields, atsType }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    await prisma.applicationAttempt.update({
      where: { id: attemptId },
      data: { status: 'failed', errorMessage: msg },
    }).catch(() => {})

    return { success: false, screenshotUrls, fieldsFilledCount: 0, skippedFields: [], atsType: 'unknown', error: msg }
  }
}

export async function runApplicationSubmit(
  attemptId: string,
  userId: string,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const attempt = await prisma.applicationAttempt.findFirst({
    where: { id: attemptId, userId },
  })
  if (!attempt) return { success: false, error: 'Attempt not found' }
  if (attempt.status !== 'awaiting_review') {
    return { success: false, error: `Cannot submit — status is "${attempt.status}"` }
  }

  await prisma.applicationAttempt.update({
    where: { id: attemptId },
    data: { status: 'submitting' },
  })

  try {
    const job = await prisma.job.findFirstOrThrow({
      where: { id: jobId, userId },
      select: { url: true },
    })
    if (!job.url) throw new Error('No URL')

    const atsType = attempt.atsType

    // Re-fill + submit in a new browser session (stateless, so we refill and submit in one go)
    const profile = await prisma.applicationProfile.findUnique({ where: { userId } })
    const resumes = await prisma.botResume.findMany({
      where: { userId },
      select: { id: true, label: true, matchKeywords: true, isDefault: true, structuredData: true, fileUrl: true },
    })

    let resume: ResumeStructuredData | null = null
    let resumeFileUrl: string | null = null
    if (resumes.length > 0) {
      const bestId = pickResumeForJob(resumes, attempt.atsType)
      const matched = resumes.find((r) => r.id === bestId)
      if (matched) {
        resume = matched.structuredData as unknown as ResumeStructuredData
        resumeFileUrl = matched.fileUrl
      }
    }

    const resumeFilePath = resumeFileUrl ? await downloadResumeToDisk(resumeFileUrl) : null
    const jobCtx = { title: atsType, company: '' }

    await withBrowser(async (page) => {
      switch (atsType) {
        case 'greenhouse': {
          await fillGreenhouseApplication(page, job.url!, profile, resume, resumeFilePath, jobCtx)
          await submitGreenhouseApplication(page)
          break
        }
        case 'lever': {
          await fillLeverApplication(page, job.url!, profile, resume, resumeFilePath, jobCtx)
          await submitLeverApplication(page)
          break
        }
        default: {
          await fillGenericApplication(page, job.url!, profile, resume, resumeFilePath, jobCtx)
          await submitGenericApplication(page)
          break
        }
      }
    })

    if (resumeFilePath) {
      try { fs.unlinkSync(resumeFilePath) } catch {}
    }

    // Mark job as APPLIED
    await prisma.$transaction([
      prisma.applicationAttempt.update({
        where: { id: attemptId },
        data: { status: 'submitted', submittedAt: new Date() },
      }),
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          tags: {
            push: 'bot-applied',
          },
          activities: {
            create: {
              userId,
              type: 'STATUS_CHANGE',
              fromStatus: 'SAVED',
              toStatus: 'APPLIED',
              description: `Bot auto-applied via ${atsType}`,
            },
          },
        },
      }),
    ])

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.applicationAttempt.update({
      where: { id: attemptId },
      data: { status: 'failed', errorMessage: msg },
    }).catch(() => {})
    return { success: false, error: msg }
  }
}

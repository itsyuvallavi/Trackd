/**
 * Bot search orchestrator.
 *
 * Flow:
 * 1. Call job search APIs (JSearch + SerpAPI) via the unified search client
 * 2. Deduplicate against existing jobs in the DB (by URL)
 * 3. Save new jobs with status SAVED + source BOT or platform-specific
 * 4. Run AI evaluator on each new job
 * 5. Return stats for BotRun logging
 */

import { prisma } from '@/lib/prisma'
import { JobSource } from '@prisma/client'
import type { BotConfig } from '@prisma/client'
import type { SearchJobResult, OrchestratorResult } from './types'
import { evaluateJob } from './job-evaluator'
import { runSearch } from './adapters/search-client'

function sourceToPrismaSource(source: string): JobSource {
  const map: Record<string, JobSource> = {
    jsearch: JobSource.BOT,
    indeed: JobSource.INDEED,
    linkedin: JobSource.LINKEDIN,
    glassdoor: JobSource.OTHER,
    serpapi_google: JobSource.BOT,
    zip_recruiter: JobSource.ZIPRECRUITER,
  }
  return map[source.toLowerCase()] ?? JobSource.BOT
}

export async function runBotSearch(
  botConfig: BotConfig,
  userId: string
): Promise<OrchestratorResult> {
  const result: OrchestratorResult = {
    jobsFound: 0,
    jobsNew: 0,
    jobsEvaluated: 0,
    jobsApproved: 0,
    errors: {},
    platformsMeta: null,
  }

  // Check that at least one search API key is configured
  if (!process.env.JSEARCH_API_KEY && !process.env.SERP_API_KEY) {
    result.errors['config'] = 'No search API keys configured. Set JSEARCH_API_KEY and/or SERP_API_KEY.'
    return result
  }

  // Run the search
  let searchResponse
  try {
    searchResponse = await runSearch({
      keywords: botConfig.keywords,
      locations: botConfig.locations.length > 0 ? botConfig.locations : ['Remote'],
      remote_only: botConfig.remoteOnly,
      exclude_companies: botConfig.excludeCompanies,
      exclude_keywords: botConfig.excludeKeywords,
      results_wanted: 30,
      experience_level: botConfig.experienceLevel,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors['search'] = msg
    console.error('[bot] Search failed:', msg)
    return result
  }

  result.jobsFound = searchResponse.jobs.length
  result.platformsMeta = searchResponse.meta

  console.log(
    `[bot] Search complete: ${searchResponse.jobs.length} jobs from [${searchResponse.meta.platforms_succeeded.join(', ')}]`
  )

  if (searchResponse.meta.platforms_failed && Object.keys(searchResponse.meta.platforms_failed).length > 0) {
    console.warn('[bot] Platform issues:', searchResponse.meta.platforms_failed)
  }

  if (searchResponse.jobs.length === 0) {
    return result
  }

  // Collect all URLs and dedup against DB (including already-applied jobs)
  const jobsWithUrls = searchResponse.jobs.filter((j) => j.url?.trim())
  const urls = jobsWithUrls.map((j) => j.url!.trim().replace(/\/$/, ''))

  const existingJobs = await prisma.job.findMany({
    where: { userId, url: { in: urls } },
    select: { url: true, status: true },
  })
  const existingUrls = new Set(existingJobs.map((j) => j.url?.replace(/\/$/, '') ?? ''))

  // Also load all applied/interview/offer jobs to block company+title duplicates
  const activeApplications = await prisma.job.findMany({
    where: { userId, status: { in: ['APPLIED', 'INTERVIEW', 'OFFER'] } },
    select: { company: true, title: true },
  })
  const appliedKeys = new Set(
    activeApplications.map((j) => `${j.company.toLowerCase()}::${j.title.toLowerCase()}`)
  )

  const newJobs = jobsWithUrls.filter((j) => {
    const url = j.url!.trim().replace(/\/$/, '')
    if (existingUrls.has(url)) return false
    // Block if already actively applying to same company+title
    const key = `${j.company.toLowerCase()}::${j.title.toLowerCase()}`
    if (appliedKeys.has(key)) {
      console.log(`[bot] Skipping duplicate application: ${j.title} @ ${j.company}`)
      return false
    }
    return true
  })
  const noUrlJobs = searchResponse.jobs.filter((j) => !j.url?.trim())
  const allNewJobs: SearchJobResult[] = [...newJobs, ...noUrlJobs]

  result.jobsNew = allNewJobs.length

  if (allNewJobs.length === 0) {
    console.log(`[bot] No new jobs for user ${userId} — all already tracked`)
    return result
  }

  console.log(`[bot] Saving ${allNewJobs.length} new jobs for user ${userId}`)

  // Evaluate and save each new job
  for (const job of allNewJobs) {
    try {
      let score = 0
      let shouldApply = false

      if (process.env.OPENAI_API_KEY) {
        try {
          const evaluation = await evaluateJob(job, botConfig)
          score = evaluation.score
          shouldApply = evaluation.shouldApply
          result.jobsEvaluated++
          if (shouldApply) result.jobsApproved++
        } catch (evalErr) {
          console.warn(`[bot] Eval skipped for "${job.title}":`, evalErr instanceof Error ? evalErr.message : evalErr)
        }
      }

      let salary: string | undefined
      if (job.salary_min || job.salary_max) {
        const currency = job.salary_currency || 'USD'
        salary = job.salary_min && job.salary_max
          ? `${currency} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`
          : `${currency} ${(job.salary_min || job.salary_max)!.toLocaleString()}`
      }

      const tags = ['bot-found']
      if (shouldApply) tags.push('bot-approved')
      if (job.is_remote) tags.push('remote')

      await prisma.job.create({
        data: {
          userId,
          title: job.title,
          company: job.company,
          location: job.location ?? null,
          url: job.url ?? null,
          source: sourceToPrismaSource(job.source),
          salary,
          tags,
          notes: score > 0 ? `AI score: ${score}/100` : undefined,
          activities: {
            create: {
              userId,
              type: 'NOTE',
              description: `Bot found via ${job.source}${score > 0 ? ` · AI score ${score}/100` : ''}`,
            },
          },
        },
      })
    } catch (saveErr) {
      const msg = saveErr instanceof Error ? saveErr.message : String(saveErr)
      console.error(`[bot] Failed to save "${job.title}":`, msg)
      result.errors[`save_${job.title.slice(0, 30)}`] = msg
    }
  }

  return result
}

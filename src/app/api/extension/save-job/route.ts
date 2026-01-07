import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { JobSource, JobStatus, ActivityType } from '@prisma/client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Authenticate via extension key
    const key = request.headers.get('X-Extension-Key')

    if (!key) {
      return Response.json({ error: 'Missing extension key' }, { status: 401 })
    }

    const keyHash = createHash('sha256').update(key).digest('hex')
    const extensionKey = await prisma.extensionKey.findUnique({
      where: { keyHash }
    })

    if (!extensionKey) {
      return Response.json({ error: 'Invalid extension key' }, { status: 401 })
    }

    // Check extension rate limit (defense in depth - middleware also checks)
    const rateLimitResult = checkRateLimit(
      `extension:key:${key}`,
      RATE_LIMITS.extension.limit,
      RATE_LIMITS.extension.window
    )
    
    if (!rateLimitResult.allowed) {
      return Response.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests from extension. Please try again later.',
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.extension.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const userId = extensionKey.userId
    const jobData = await request.json()

    // Validate and sanitize input with length limits
    if (!jobData.company || typeof jobData.company !== 'string') {
      return Response.json(
        { error: 'Company is required' },
        { status: 400 }
      )
    }

    if (!jobData.title || typeof jobData.title !== 'string') {
      return Response.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Sanitize and limit field lengths to prevent abuse
    const company = jobData.company.trim().slice(0, 200)
    const title = jobData.title.trim().slice(0, 300)
    const location = jobData.location ? String(jobData.location).trim().slice(0, 200) : null
    const url = jobData.url ? String(jobData.url).trim().slice(0, 2048) : null
    const salary = jobData.salary ? String(jobData.salary).trim().slice(0, 100) : null

    // Validate URL format if provided
    if (url) {
      try {
        const urlObj = new URL(url)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return Response.json({ error: 'Invalid URL protocol' }, { status: 400 })
        }
      } catch {
        return Response.json({ error: 'Invalid URL format' }, { status: 400 })
      }
    }

    if (company.length === 0 || title.length === 0) {
      return Response.json(
        { error: 'Company and title cannot be empty' },
        { status: 400 }
      )
    }

    // Check for duplicates (same company + title within 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const duplicate = await prisma.job.findFirst({
      where: {
        userId,
        company: { equals: company, mode: 'insensitive' },
        title: { equals: title, mode: 'insensitive' },
        createdAt: { gte: thirtyDaysAgo }
      }
    })

    if (duplicate) {
      return Response.json({
        error: 'DUPLICATE_JOB',
        message: 'You already saved this job',
        existingJob: {
          id: duplicate.id,
          savedAt: duplicate.createdAt
        }
      }, { status: 409 })
    }

    // Map source string to JobSource enum
    const sourceMap: Record<string, JobSource> = {
      'LinkedIn': JobSource.LINKEDIN,
      'Indeed': JobSource.INDEED,
      'Greenhouse': JobSource.COMPANY_SITE,
      'Lever': JobSource.COMPANY_SITE,
      'Workable': JobSource.WORKABLE,
      'EU Remote Jobs': JobSource.EU_REMOTE_JOBS,
      'ZipRecruiter': JobSource.ZIPRECRUITER,
      'Landing.jobs': JobSource.LANDING_JOBS,
      'Extension': JobSource.OTHER,
    }
    const source = sourceMap[jobData.source] || JobSource.OTHER

    // Create the job with APPLIED status
    const job = await prisma.job.create({
      data: {
        userId,
        company,
        title,
        location,
        url,
        source,
        salary,
        status: JobStatus.APPLIED,
        appliedAt: new Date(), // Set applied date since status is APPLIED
      }
    })

    // Create activity
    await prisma.activity.create({
      data: {
        jobId: job.id,
        userId,
        type: ActivityType.STATUS_CHANGE,
        fromStatus: null,
        toStatus: JobStatus.APPLIED,
        description: `Job saved via Chrome extension from ${jobData.source || 'unknown source'}`
      }
    })

    // Update key last used
    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: { lastUsedAt: new Date() }
    })

    return Response.json({
      success: true,
      job: { id: job.id, company: job.company, title: job.title }
    })
  } catch (error) {
    console.error('Error saving job from extension:', error)
    return Response.json(
      { error: 'Failed to save job' },
      { status: 500 }
    )
  }
}


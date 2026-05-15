import { prisma } from '@/lib/prisma'
import { JobStatus, ActivityType } from '@prisma/client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { hashExtensionKey, isValidExtensionKeyFormat, sanitizeExtensionJobPayload } from '@/lib/extension-jobs'

export async function POST(request: Request) {
  try {
    // Authenticate via extension key
    const key = request.headers.get('X-Extension-Key')

    if (!key) {
      return Response.json({ error: 'Missing extension key' }, { status: 401 })
    }

    if (!isValidExtensionKeyFormat(key)) {
      return Response.json({ error: 'Invalid extension key format' }, { status: 400 })
    }

    const keyHash = hashExtensionKey(key)
    // Check extension rate limit (defense in depth - middleware also checks)
    const rateLimitResult = checkRateLimit(
      `extension:key:${keyHash.slice(0, 16)}`,
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

    const extensionKey = await prisma.extensionKey.findUnique({
      where: { keyHash }
    })

    if (!extensionKey) {
      return Response.json({ error: 'Invalid extension key' }, { status: 401 })
    }

    const userId = extensionKey.userId
    const jobData = await request.json()
    const sanitized = sanitizeExtensionJobPayload(jobData)

    if (!sanitized.ok) {
      return Response.json({ error: sanitized.error }, { status: sanitized.status })
    }
    const { company, title, location, url, salary, source, sourceLabel } = sanitized.data

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
        description: `Job saved via Chrome extension from ${sourceLabel || 'unknown source'}`
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

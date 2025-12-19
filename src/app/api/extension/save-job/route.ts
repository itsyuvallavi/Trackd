import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { JobSource, JobStatus, ActivityType } from '@prisma/client'

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

    const userId = extensionKey.userId
    const jobData = await request.json()

    // Validate required fields
    if (!jobData.company || !jobData.title) {
      return Response.json(
        { error: 'Company and title are required' },
        { status: 400 }
      )
    }

    // Check for duplicates (same company + title within 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const duplicate = await prisma.job.findFirst({
      where: {
        userId,
        company: { equals: jobData.company, mode: 'insensitive' },
        title: { equals: jobData.title, mode: 'insensitive' },
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
      'Extension': JobSource.OTHER,
    }
    const source = sourceMap[jobData.source] || JobSource.OTHER

    // Create the job with APPLIED status
    const job = await prisma.job.create({
      data: {
        userId,
        company: jobData.company,
        title: jobData.title,
        location: jobData.location || null,
        url: jobData.url || null,
        source,
        salary: jobData.salary || null,
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


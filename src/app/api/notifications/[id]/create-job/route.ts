import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { JobStatus } from '@prisma/client'
import { cacheTagsFor } from '@/lib/cache-tags'

/**
 * POST /api/notifications/[id]/create-job
 * Create a job from a NEW_JOB_DETECTED notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Get the notification
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: user.id,
        type: 'NEW_JOB_DETECTED',
      },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    const metadata = notification.metadata as any
    
    // For unmatched emails, we might not have both company and title
    // In that case, redirect to the no-match page instead
    if (metadata.hasInsufficientInfo || (!metadata.company && !metadata.title)) {
      return NextResponse.json(
        { 
          error: 'Insufficient information',
          redirectTo: `/notifications/no-match?notificationId=${id}`
        },
        { status: 400 }
      )
    }

    if (!metadata.company || !metadata.title) {
      return NextResponse.json(
        { error: 'Invalid notification data' },
        { status: 400 }
      )
    }

    // Check if job already exists (user might have created it manually)
    const existingJob = await prisma.job.findFirst({
      where: {
        userId: user.id,
        company: {
          contains: metadata.company,
          mode: 'insensitive',
        },
        title: {
          contains: metadata.title,
          mode: 'insensitive',
        },
      },
    })

    if (existingJob) {
      // Job already exists - just mark notification as read and return job
      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      })
      revalidateTag(cacheTagsFor(user.id).notifications, { expire: 0 })
      return NextResponse.json({
        success: true,
        jobId: existingJob.id,
        message: 'Job already exists',
      })
    }

    // Create the job
    const newJob = await prisma.job.create({
      data: {
        userId: user.id,
        title: metadata.title,
        company: metadata.company,
        location: metadata.location || null,
        status: (metadata.suggestedStatus as JobStatus) || JobStatus.APPLIED,
        source: 'RECRUITER',
        contactEmail: metadata.emailFrom || null,
        appliedAt: metadata.suggestedStatus === JobStatus.APPLIED && metadata.emailDate
          ? new Date(metadata.emailDate)
          : null,
      },
    })

    // Create activity record
    await prisma.activity.create({
      data: {
        jobId: newJob.id,
        userId: user.id,
        type: 'EMAIL_UPDATE',
        toStatus: (metadata.suggestedStatus as JobStatus) || JobStatus.APPLIED,
        description: `Job created from email: ${metadata.emailSubject || 'New job detected'}`,
      },
    })

    // Mark notification as read
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    const tags = cacheTagsFor(user.id)
    revalidateTag(tags.jobs, { expire: 0 })
    revalidateTag(tags.activity, { expire: 0 })
    revalidateTag(tags.notifications, { expire: 0 })

    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      message: 'Job created successfully',
    })
  } catch (error) {
    console.error('Error creating job from notification:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}

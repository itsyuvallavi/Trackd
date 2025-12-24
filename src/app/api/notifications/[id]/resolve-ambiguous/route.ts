import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { JobStatus, ActivityType } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: notificationId } = await params
    const body = await request.json()
    const { jobId, suggestedStatus } = body

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Verify notification belongs to user and is ambiguous match
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        type: 'AMBIGUOUS_MATCH',
      },
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Verify job belongs to user
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId: user.id,
      },
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify job is in the matched jobs list
    const metadata = notification.metadata as {
      matchedJobs: Array<{ id: string }>
    }
    const isMatched = metadata.matchedJobs.some(mj => mj.id === jobId)
    if (!isMatched) {
      return NextResponse.json(
        { error: 'Job is not in the matched jobs list' },
        { status: 400 }
      )
    }

    // Update job status if suggested status is provided and is an advancement
    let updatedStatus = job.status
    if (suggestedStatus) {
      const statusHierarchy = {
        SAVED: 0,
        APPLIED: 1,
        INTERVIEW: 2,
        OFFER: 3,
        REJECTED: 99,
        GHOSTED: 99,
      }

      const currentLevel = statusHierarchy[job.status]
      const suggestedLevel = statusHierarchy[suggestedStatus as JobStatus]

      // Only update if suggested status is higher (advancing) or if it's a rejection
      if (suggestedLevel > currentLevel || suggestedStatus === JobStatus.REJECTED) {
        updatedStatus = suggestedStatus as JobStatus

        // Update job
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: updatedStatus,
            appliedAt: updatedStatus === JobStatus.APPLIED && !job.appliedAt ? new Date() : job.appliedAt,
            interviewAt: updatedStatus === JobStatus.INTERVIEW && !job.interviewAt ? new Date() : job.interviewAt,
          },
        })

        // Create activity
        await prisma.activity.create({
          data: {
            jobId,
            userId: user.id,
            type: getActivityType(suggestedStatus as JobStatus),
            fromStatus: job.status,
            toStatus: updatedStatus,
            description: `Status updated from ambiguous email match`,
          },
        })

        // Create job updated notification
        const notificationService = new NotificationService()
        await notificationService.createJobUpdatedNotification(
          user.id,
          jobId,
          job.title,
          job.company,
          job.status,
          updatedStatus,
          'email'
        )
      }
    }

    // Mark notification as read and update metadata
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        metadata: {
          ...metadata,
          resolvedJobId: jobId,
          resolvedAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({
      success: true,
      jobId,
      statusUpdated: updatedStatus !== job.status,
      newStatus: updatedStatus,
    })
  } catch (error) {
    console.error('Error resolving ambiguous match:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve ambiguous match' },
      { status: 500 }
    )
  }
}

function getActivityType(status: JobStatus): ActivityType {
  switch (status) {
    case JobStatus.INTERVIEW:
      return ActivityType.INTERVIEW
    case JobStatus.REJECTED:
      return ActivityType.REJECTION
    case JobStatus.OFFER:
      return ActivityType.OFFER
    default:
      return ActivityType.STATUS_CHANGE
  }
}

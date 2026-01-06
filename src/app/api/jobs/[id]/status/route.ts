import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { JobStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

/**
 * PATCH /api/jobs/[id]/status
 * Update job status - used for optimistic updates from SWR
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body as { status: JobStatus }

    // Validate status
    const validStatuses: JobStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Verify job belongs to user
    const existingJob = await prisma.job.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existingJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Update job status
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPLIED' && !existingJob.appliedAt && { appliedAt: new Date() }),
      },
    })

    // Create activity record for status change
    if (existingJob.status !== status) {
      await prisma.activity.create({
        data: {
          jobId: id,
          userId: user.id,
          type: 'STATUS_CHANGE',
          fromStatus: existingJob.status,
          toStatus: status,
        },
      })
    }

    // Revalidate relevant pages
    revalidatePath('/jobs')
    revalidatePath('/board')
    revalidatePath('/today')

    return NextResponse.json({ job: updatedJob })
  } catch (error) {
    console.error('Error updating job status:', error)
    return NextResponse.json(
      { error: 'Failed to update job status' },
      { status: 500 }
    )
  }
}


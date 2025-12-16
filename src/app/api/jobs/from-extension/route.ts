import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { createJobSchema } from '@/lib/validations/job'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate the data
    const validated = createJobSchema.parse(body)

    // Create the job
    const job = await prisma.job.create({
      data: {
        ...validated,
        userId: TEMP_USER_ID,
        url: validated.url || null,
        location: validated.location || null,
        notes: validated.notes || null,
        salary: validated.salary || null,
        contactName: validated.contactName || null,
        contactEmail: validated.contactEmail || null,
        nextAction: validated.nextAction || null,
        appliedAt: validated.status === 'APPLIED' ? new Date() : null,
      },
    })

    // Create initial activity
    await prisma.activity.create({
      data: {
        jobId: job.id,
        userId: TEMP_USER_ID,
        type: 'NOTE',
        description: `Job "${job.title}" at ${job.company} saved from browser extension`,
      },
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job saved successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error saving job from extension:', error)

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid job data',
        details: error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to save job'
    }, { status: 500 })
  }
}

// Enable CORS for local development
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

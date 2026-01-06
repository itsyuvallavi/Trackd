import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { InterviewType } from '@prisma/client'

/**
 * POST /api/interview/sessions
 * Create a new interview session
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { jobId, type } = body as {
      jobId?: string
      type?: InterviewType
    }

    // Validate jobId if provided
    if (jobId) {
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
    }

    const session = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        jobId: jobId || null,
        type: type || 'MIXED',
        status: 'IN_PROGRESS',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            notes: true,
            url: true,
            interviewAt: true,
          },
        },
      },
    })

    return NextResponse.json({ sessionId: session.id, session })
  } catch (error) {
    console.error('Error creating interview session:', error)
    return NextResponse.json(
      { error: 'Failed to create interview session' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/interview/sessions
 * List user's interview sessions
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const sessions = await prisma.interviewSession.findMany({
      where: {
        userId: user.id,
        ...(status && { status: status as any }),
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching interview sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interview sessions' },
      { status: 500 }
    )
  }
}


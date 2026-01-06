import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { InterviewSessionStatus } from '@prisma/client'

/**
 * GET /api/interview/sessions/[id]
 * Get session details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    const session = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
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
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error fetching interview session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interview session' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/interview/sessions/[id]
 * Update session (complete, abandon)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    const body = await request.json()
    const { status, duration } = body as {
      status?: InterviewSessionStatus
      duration?: number
    }

    const session = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    if (status) {
      updateData.status = status
      if (status === 'COMPLETED' || status === 'ABANDONED') {
        updateData.completedAt = new Date()
        if (duration !== undefined) {
          updateData.duration = duration
        } else {
          // Calculate duration if not provided
          const startTime = session.startedAt.getTime()
          const endTime = new Date().getTime()
          updateData.duration = Math.floor((endTime - startTime) / 1000)
        }
      }
    }

    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: updateData,
    })

    return NextResponse.json({ session: updated })
  } catch (error) {
    console.error('Error updating interview session:', error)
    return NextResponse.json(
      { error: 'Failed to update interview session' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/interview/sessions/[id]
 * Delete session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    const session = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    await prisma.interviewSession.delete({
      where: { id: sessionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting interview session:', error)
    return NextResponse.json(
      { error: 'Failed to delete interview session' },
      { status: 500 }
    )
  }
}


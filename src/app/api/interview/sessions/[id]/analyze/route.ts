import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ConversationManager } from '@/lib/interview/conversation-manager'

/**
 * POST /api/interview/sessions/[id]/analyze
 * Analyze user response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    const body = await request.json()
    const { question, response, questionType } = body as {
      question: string
      response: string
      questionType?: string
    }

    if (!question || !response) {
      return NextResponse.json(
        { error: 'Question and response are required' },
        { status: 400 }
      )
    }

    // Get session with job context
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
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Create conversation manager
    const jobContext = session.job
      ? {
          id: session.job.id,
          title: session.job.title,
          company: session.job.company,
          location: session.job.location,
          notes: session.job.notes,
          url: session.job.url,
          interviewAt: session.job.interviewAt,
        }
      : undefined

    const manager = new ConversationManager(
      sessionId,
      session.type,
      jobContext
    )

    // Analyze response
    const analysis = await manager.analyzeResponse(
      question,
      response,
      questionType || 'general'
    )

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error analyzing response:', error)
    return NextResponse.json(
      { error: 'Failed to analyze response' },
      { status: 500 }
    )
  }
}


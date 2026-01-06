import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ConversationManager } from '@/lib/interview/conversation-manager'
import { InterviewMessage } from '@/lib/interview/types'

/**
 * POST /api/interview/sessions/[id]/summary
 * Generate session summary
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Get session with messages and job context
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
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages in session' },
        { status: 400 }
      )
    }

    // Build conversation history
    const conversationHistory: InterviewMessage[] = session.messages.map(
      (msg: typeof session.messages[number]) => ({
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        audioUrl: msg.audioUrl,
        timestamp: msg.timestamp,
        duration: msg.duration,
        questionType: msg.questionType,
        feedback: msg.feedback,
      })
    )

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

    // Generate summary
    const summary = await manager.generateSummary(conversationHistory)

    // Calculate duration
    const startTime = session.startedAt.getTime()
    const endTime = new Date().getTime()
    const duration = Math.floor((endTime - startTime) / 1000)

    // Update session with summary
    const updatedSession = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        duration,
        summary: summary.summary,
        strengths: summary.strengths,
        improvements: summary.improvements,
        tips: summary.tips,
      },
      include: {
        job: true,
      },
    })

    // Create Activity record if session is linked to a job
    if (updatedSession.jobId && updatedSession.job) {
      await prisma.activity.create({
        data: {
          jobId: updatedSession.jobId,
          userId: updatedSession.userId,
          type: 'NOTE',
          description: `Completed interview prep session (${updatedSession.type.toLowerCase()})`,
          metadata: {
            interviewPrepSessionId: sessionId,
            summary: summary.summary,
            strengths: summary.strengths,
            improvements: summary.improvements,
            tips: summary.tips,
          } as any,
        },
      })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}


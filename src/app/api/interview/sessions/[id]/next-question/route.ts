import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ConversationManager } from '@/lib/interview/conversation-manager'
import { InterviewMessage } from '@/lib/interview/types'

/**
 * POST /api/interview/sessions/[id]/next-question
 * Generate next question for the interview
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

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

    // Build conversation history
    const conversationHistory: InterviewMessage[] = session.messages.map(
      (msg: any) => ({
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

    // Generate next question
    const questionResponse = await manager.generateNextQuestion(
      conversationHistory
    )

    // Save the question as an assistant message
    await prisma.interviewMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: questionResponse.question,
        questionType: questionResponse.type,
        feedback: questionResponse.feedback
          ? (questionResponse.feedback as any)
          : null,
      },
    })

    return NextResponse.json({ question: questionResponse })
  } catch (error) {
    console.error('Error generating next question:', error)
    return NextResponse.json(
      { error: 'Failed to generate next question' },
      { status: 500 }
    )
  }
}


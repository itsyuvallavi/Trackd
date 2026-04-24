import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ConversationManager } from '@/lib/interview/conversation-manager'
import { InterviewMessage } from '@/lib/interview/types'
import { withTimeout } from '@/lib/with-timeout'

/**
 * POST /api/interview/sessions/[id]/next-question
 * Generate next question for the interview
 */
async function handleNextQuestion(
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
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const recentMessageRows = await prisma.interviewMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        sessionId: true,
        role: true,
        content: true,
        audioUrl: true,
        timestamp: true,
        duration: true,
        questionType: true,
        feedback: true,
      },
    })
    const messagesChrono = recentMessageRows.slice().reverse()

    // Build conversation history (most recent 50 messages only)
    const conversationHistory: InterviewMessage[] = messagesChrono.map(
      (msg) => ({
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

// Export with timeout wrapper (60 seconds for AI generation)
export const POST = withTimeout(handleNextQuestion, 60000)


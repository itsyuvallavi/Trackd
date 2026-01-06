import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/interview/sessions/[id]/messages
 * Add message to session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Verify session belongs to user
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

    const body = await request.json()
    const { role, content, audioUrl, duration, questionType, feedback } =
      body as {
        role: 'user' | 'assistant' | 'system'
        content: string
        audioUrl?: string
        duration?: number
        questionType?: string
        feedback?: any
      }

    const message = await prisma.interviewMessage.create({
      data: {
        sessionId,
        role,
        content,
        audioUrl: audioUrl || null,
        duration: duration || null,
        questionType: questionType || null,
        feedback: feedback ? (feedback as any) : null,
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Error creating interview message:', error)
    return NextResponse.json(
      { error: 'Failed to create interview message' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/interview/sessions/[id]/messages
 * Get conversation history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Verify session belongs to user
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

    const messages = await prisma.interviewMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching interview messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interview messages' },
      { status: 500 }
    )
  }
}


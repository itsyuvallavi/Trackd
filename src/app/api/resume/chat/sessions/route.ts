import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ResumeChatManager } from '@/lib/resume/resume-chat-manager'

/**
 * POST /api/resume/chat/sessions
 * Initialize AI analysis for an existing session (created by upload route)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { sessionId } = body as {
      sessionId: string
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get session
    const session = await prisma.resumeSession.findFirst({
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

    if (!session.resumeFileUrl && !session.openaiFileId) {
      return NextResponse.json(
        { error: 'Session does not have a resume file' },
        { status: 400 }
      )
    }

    // Initialize chat with AI analysis
    // Use OpenAI file ID if available, otherwise use fileUrl
    const fileReference = session.openaiFileId 
      ? `openai://${session.openaiFileId}` 
      : session.resumeFileUrl
    
    console.log('[API] Creating ResumeChatManager with:', {
      sessionId: session.id,
      fileReference,
      fileName: session.resumeFileName,
      openaiFileId: session.openaiFileId,
      resumeFileUrl: session.resumeFileUrl,
    })
    
    const manager = new ResumeChatManager(
      session.id,
      fileReference,
      session.resumeFileName
    )
    
    console.error('[API] ===== CALLING generateInitialAnalysis =====')
    let initialMessage: string
    try {
      initialMessage = await manager.generateInitialAnalysis()
      console.error('[API] Initial analysis generated, length:', initialMessage.length)
    } catch (analysisError: any) {
      console.error('[API] ERROR in generateInitialAnalysis:', analysisError?.message)
      console.error('[API] Error stack:', analysisError?.stack)
      console.error('[API] Full error:', JSON.stringify(analysisError, null, 2))
      throw analysisError
    }

    // Save OpenAI IDs for future use
    const { fileId, assistantId, threadId } = manager.getOpenAIIds()
    await prisma.resumeSession.update({
      where: { id: session.id },
      data: {
        openaiFileId: fileId,
        openaiAssistantId: assistantId,
        openaiThreadId: threadId,
      },
    })

    // Save initial AI message
    await prisma.resumeMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: initialMessage,
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error initializing resume session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error ? error.stack : String(error)
    console.error('Error details:', errorDetails)
    
    return NextResponse.json(
      { 
        error: 'Failed to initialize resume session',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/resume/chat/sessions
 * Get user's resume sessions
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const sessions = await prisma.resumeSession.findMany({
      where: {
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
          take: 5, // Get first few messages for summary
          select: {
            id: true,
            role: true,
            content: true,
            timestamp: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 20,
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching resume sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resume sessions' },
      { status: 500 }
    )
  }
}


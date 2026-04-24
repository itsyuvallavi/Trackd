import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ResumeChatManager } from '@/lib/resume/resume-chat-manager'
import { parseResumeText } from '@/lib/resume/resume-template'
import { getResumeAIClient } from '@/lib/ai/client'
import { withTimeout } from '@/lib/with-timeout'

/**
 * GET /api/resume/chat/sessions/[id]/messages
 * Get messages for a resume session
 */
async function handleGetMessages(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Verify session belongs to user
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

    const messages = await prisma.resumeMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 200,
      select: {
        id: true,
        sessionId: true,
        role: true,
        content: true,
        timestamp: true,
      },
    })
    const messagesAsc = messages.slice().reverse()

    return NextResponse.json({ 
      messages: messagesAsc,
      hasImprovedResume: !!session.improvedResumeText,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/resume/chat/sessions/[id]/messages
 * Send a message and get AI response
 */
async function handlePostMessage(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    const body = await request.json()
    const { content } = body as {
      content: string
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Message content is required and must be a string' },
        { status: 400 }
      )
    }

    // Sanitize and limit message length (max 10KB to prevent abuse)
    const sanitizedContent = content.trim().slice(0, 10000)
    
    if (sanitizedContent.length === 0) {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      )
    }

    // Verify session belongs to user
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

    // Save user message
    const userMessage = await prisma.resumeMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: sanitizedContent,
      },
    })

    const RESUME_CONTEXT_LIMIT = 80
    const recent = await prisma.resumeMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: RESUME_CONTEXT_LIMIT,
      select: {
        id: true,
        role: true,
        content: true,
        timestamp: true,
      },
    })
    const messages = recent.slice().reverse()

    // Generate AI response
    if (!session.resumeFileUrl && !session.openaiFileId) {
      return NextResponse.json(
        { error: 'Session does not have a resume file' },
        { status: 400 }
      )
    }

    // Use OpenAI file ID if available, otherwise use fileUrl
    const fileReference = session.openaiFileId 
      ? `openai://${session.openaiFileId}` 
      : session.resumeFileUrl
    
    const manager = new ResumeChatManager(
      session.id,
      fileReference!,
      session.resumeFileName
    )

    // If OpenAI IDs exist, use them (session already initialized)
    if (session.openaiFileId && session.openaiAssistantId && session.openaiThreadId) {
      await manager.initializeWithIds(
        session.openaiFileId,
        session.openaiAssistantId,
        session.openaiThreadId
      )
    }

    // Check if user is asking for PDF/resume generation
    const userMessageLower = sanitizedContent.toLowerCase().trim()
    
    // Detect various ways user might request resume generation
    const isAffirmativeResponse = /^(yes|yeah|yep|sure|ok|okay|please|definitely|absolutely|go ahead|do it|let's do it|sounds good|that would be great|i'd like that|generate|create)/.test(userMessageLower)
    const isExplicitRequest = /pdf|download|generate.*resume|create.*resume|make.*resume|improved.*resume|new.*resume|formatted|polished/i.test(userMessageLower)
    const isGenerationRequest = isAffirmativeResponse || isExplicitRequest

    let additionalContext: string | undefined
    let resumeGenerated = false

    // If user is asking for PDF/generation, generate it
    if (isGenerationRequest) {
      try {
        console.log('[Messages API] Generation request detected, creating improved resume...')
        
        // Generate improved resume text
        const conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        
        const improvedResume = await manager.generateImprovedResume(conversationHistory)
        console.log('[Messages API] Improved resume generated, length:', improvedResume.length)
        
        // PRE-PARSE the resume data NOW (not at preview time)
        // This is the key performance optimization - parsing happens during generation
        console.log('[Messages API] Pre-parsing resume data for faster preview...')
        let parsedResumeData = null
        try {
          const aiClient = getResumeAIClient()
          parsedResumeData = await parseResumeText(improvedResume, aiClient)
          console.log('[Messages API] Resume pre-parsed successfully')
        } catch (parseError) {
          // Log but don't fail - preview will parse on-demand if needed
          console.error('[Messages API] Pre-parsing failed (non-fatal):', parseError)
        }
        
        // Save improved resume WITH pre-parsed data
        await prisma.resumeSession.update({
          where: { id: sessionId },
          data: { 
            improvedResumeText: improvedResume,
            // Cast to any for Prisma JSON field compatibility
            parsedResumeData: parsedResumeData ? (parsedResumeData as any) : undefined,
          },
        })
        
        console.log('[Messages API] Improved resume saved with pre-parsed data')
        resumeGenerated = true
        additionalContext = `The user requested a generated resume. The improved resume has been created and saved successfully. Tell them it's ready and they can use the "View Resume" and "Download PDF" buttons that will appear below to preview and download their polished resume. IMPORTANT: DO NOT output the resume text in your response - the system handles displaying it through the preview buttons. Just acknowledge that it's ready.`
      } catch (error) {
        console.error('Error generating resume:', error)
        additionalContext = `There was an issue generating the resume. Apologize briefly and ask them to try again.`
      }
    }

    const aiResponse = await manager.generateResponse(
      messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      additionalContext
    )

    // Save AI message
    const assistantMessage = await prisma.resumeMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponse,
      },
    })

    return NextResponse.json({
      userMessage,
      assistantMessage,
      resumeGenerated, // Let UI know if resume is ready
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

// Export with timeout wrappers (90 seconds for AI responses - includes pre-parsing)
export const GET = withTimeout(handleGetMessages, 30000)
export const POST = withTimeout(handlePostMessage, 90000)

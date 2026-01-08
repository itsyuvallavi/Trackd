/**
 * Resume Chat Manager
 * 
 * Manages AI resume conversation flow, analysis, and improvements.
 * 
 * FLOW:
 * 1. User uploads resume
 * 2. AI analyzes and gives feedback
 * 3. AI suggests creating improved version
 * 4. If user agrees, AI generates improved resume using ONLY original data
 * 5. If data is missing, AI asks user for it
 */

import { getResumeAIClient } from '../ai/client'
import { getResumeSystemPrompt, getExtractResumePrompt, getImprovedResumePrompt } from './prompts'

export class ResumeChatManager {
  private client = getResumeAIClient()
  private sessionId: string
  private fileUrl: string
  private fileName: string
  private openaiFileId: string | null = null
  private assistantId: string | null = null
  private threadId: string | null = null
  private initialized: boolean = false

  constructor(sessionId: string, fileUrl: string, fileName: string) {
    this.sessionId = sessionId
    this.fileUrl = fileUrl
    this.fileName = fileName
  }

  /**
   * Initialize the session with OpenAI
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Extract OpenAI file ID from fileUrl (format: openai://file_id)
      if (this.fileUrl.startsWith('openai://')) {
        this.openaiFileId = this.fileUrl.replace('openai://', '')
      } else {
        throw new Error('File URL format not recognized. File must be uploaded to OpenAI first.')
      }

      // Create assistant with system prompt
      const instructions = getResumeSystemPrompt()
      this.assistantId = await this.client.createAssistantWithFile(
        this.openaiFileId,
        instructions
      )

      // Create thread with initial analysis request
      console.log('[ResumeChatManager] Creating thread with fileId:', this.openaiFileId)
      const createdThreadId = await this.client.createThreadWithFile(
        this.openaiFileId,
        'Please review this resume and give me honest, helpful feedback. What\'s working well, and what are 2-3 things I could improve?'
      )

      if (!createdThreadId || typeof createdThreadId !== 'string') {
        throw new Error('Failed to create thread')
      }

      this.threadId = createdThreadId
      this.initialized = true

      console.log('[ResumeChatManager] Initialization complete:', {
        fileId: this.openaiFileId,
        assistantId: this.assistantId,
        threadId: this.threadId,
      })
    } catch (error) {
      console.error('Error initializing ResumeChatManager:', error)
      throw new Error('Failed to initialize resume analysis')
    }
  }

  /**
   * Initialize with existing OpenAI IDs (for continuing sessions)
   */
  async initializeWithIds(
    fileId: string,
    assistantId: string,
    threadId: string
  ): Promise<void> {
    this.openaiFileId = fileId
    this.assistantId = assistantId
    this.threadId = threadId
    this.initialized = true
  }

  /**
   * Generate initial resume analysis
   */
  async generateInitialAnalysis(): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      if (!this.threadId || !this.assistantId) {
        throw new Error('Session not properly initialized')
      }

      // Run assistant to analyze the resume
      await this.client.runAssistant(this.threadId, this.assistantId)

      // Get the analysis response
      const messages = await this.client.getThreadMessages(this.threadId)
      const lastMessage = messages[messages.length - 1]?.content || 'Unable to analyze resume at this time.'

      return lastMessage
    } catch (error) {
      console.error('Error generating initial analysis:', error)
      throw new Error('Failed to generate resume analysis')
    }
  }

  /**
   * Generate response to user message
   */
  async generateResponse(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    additionalContext?: string
  ): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      // Get the last user message
      const lastUserMessage = conversationHistory[conversationHistory.length - 1]?.content || ''

      if (!lastUserMessage) {
        throw new Error('No user message provided')
      }

      // Add user message to thread
      const messageWithContext = additionalContext
        ? `${lastUserMessage}\n\n[System: ${additionalContext}]`
        : lastUserMessage

      await this.client.addMessageToThread(this.threadId!, messageWithContext)

      // Run assistant
      await this.client.runAssistant(this.threadId!, this.assistantId!)

      // Get response
      const messages = await this.client.getThreadMessages(this.threadId!)
      return messages[messages.length - 1]?.content || 'I apologize, but I could not generate a response.'
    } catch (error) {
      console.error('Error generating response:', error)
      throw new Error('Failed to generate response')
    }
  }

  /**
   * Generate improved resume version
   * 
   * This uses a two-step process:
   * 1. Extract original resume text from the file
   * 2. Generate improved version using ONLY that data
   */
  async generateImprovedResume(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      // Step 1: Extract original resume content from the file
      console.log('[ResumeChatManager] Extracting original resume content...')
      
      await this.client.addMessageToThread(
        this.threadId!,
        getExtractResumePrompt()
      )

      await this.client.runAssistant(this.threadId!, this.assistantId!)
      const extractionMessages = await this.client.getThreadMessages(this.threadId!)
      const originalResumeText = extractionMessages[extractionMessages.length - 1]?.content || ''

      // Clean up extracted text
      const cleanOriginalText = originalResumeText
        .replace(/^(here'?s|this is|the resume|extracted):?\s*/i, '')
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()

      if (!cleanOriginalText || cleanOriginalText.length < 100) {
        console.error('[ResumeChatManager] Failed to extract resume content')
        throw new Error('Failed to extract resume content from file')
      }

      console.log('[ResumeChatManager] Original resume extracted, length:', cleanOriginalText.length)

      // Step 2: Generate improved resume using direct chat completion
      // This ensures we get actual resume content, not a conversational response
      const conversationContext = conversationHistory
        .slice(-5)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n')

      const response = await this.client.chatCompletion([
        {
          role: 'system',
          content: `You are a resume optimization expert. You generate improved resume text based on original resumes.

CRITICAL RULES:
1. Use ONLY information from the original resume - NEVER add or fabricate data
2. NEVER add metrics, percentages, or achievements not in the original
3. NEVER add skills, certifications, or experiences not in the original
4. Only improve wording and formatting - preserve all facts exactly
5. Return ONLY the resume text - no explanations or messages
6. Start directly with the person's name`
        },
        {
          role: 'user',
          content: getImprovedResumePrompt(cleanOriginalText, conversationContext)
        }
      ], {
        temperature: 0.3,
        maxTokens: 4000,
        responseFormat: 'text',
      })

      let resumeText = response.data.choices[0]?.message?.content || ''

      // Clean up response
      resumeText = resumeText
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/\n?```$/i, '')
        .replace(/^(here'?s|this is|the improved resume):?\s*/i, '')
        .trim()

      // Validate that we got actual resume content
      if (resumeText.length < 300 ||
          resumeText.toLowerCase().includes('creating your') ||
          resumeText.toLowerCase().includes('preview card') ||
          resumeText.toLowerCase().includes('here\'s your')) {
        console.error('[ResumeChatManager] AI returned a message instead of resume content')
        throw new Error('Failed to generate resume content. Please try again.')
      }

      console.log('[ResumeChatManager] Improved resume generated, length:', resumeText.length)
      return resumeText
    } catch (error) {
      console.error('Error generating improved resume:', error)
      throw new Error('Failed to generate improved resume')
    }
  }

  /**
   * Get OpenAI IDs for session persistence
   */
  getOpenAIIds(): {
    fileId: string | null
    assistantId: string | null
    threadId: string | null
  } {
    return {
      fileId: this.openaiFileId,
      assistantId: this.assistantId,
      threadId: this.threadId,
    }
  }
}

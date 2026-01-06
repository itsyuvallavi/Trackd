/**
 * Resume Chat Manager
 * 
 * Manages AI resume conversation flow, analysis, and improvements
 * Uses OpenAI Assistants API with file uploads
 */

import { getAIClient } from '../ai/client'
import { getResumeSystemPrompt } from './prompts'

export class ResumeChatManager {
  private client = getAIClient()
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
   * Initialize: Use OpenAI file ID directly (file already uploaded)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Extract OpenAI file ID from fileUrl (format: openai://file_id)
      // Or use the fileUrl directly if it's already an OpenAI file ID
      if (this.fileUrl.startsWith('openai://')) {
        this.openaiFileId = this.fileUrl.replace('openai://', '')
      } else {
        // Fallback: if fileUrl is not in expected format, we'd need to upload
        // But for now, assume it's already uploaded and stored as openaiFileId
        throw new Error('File URL format not recognized. File must be uploaded to OpenAI first.')
      }

      // Create assistant with system prompt
      const instructions = getResumeSystemPrompt('')
      this.assistantId = await this.client.createAssistantWithFile(
        this.openaiFileId,
        instructions
      )

      // Create thread with initial message
      console.log('[ResumeChatManager] Creating thread with fileId:', this.openaiFileId)
      const createdThreadId = await this.client.createThreadWithFile(
        this.openaiFileId,
        'Take a look at this resume and give them some friendly, honest feedback. What\'s working well, and what are 2-3 simple things they could improve? Keep it conversational and helpful.'
      )
      
      console.log('[ResumeChatManager] Thread created, returned value:', {
        threadId: createdThreadId,
        threadIdType: typeof createdThreadId,
        isString: typeof createdThreadId === 'string',
        isEmpty: createdThreadId === '',
      })

      if (!createdThreadId) {
        throw new Error('Failed to create thread - threadId is missing')
      }
      
      if (typeof createdThreadId !== 'string') {
        throw new Error(`Thread ID must be a string, got: ${typeof createdThreadId} ${JSON.stringify(createdThreadId)}`)
      }

      this.threadId = createdThreadId

      console.log('[ResumeChatManager] Initialization complete:', {
        fileId: this.openaiFileId,
        assistantId: this.assistantId,
        threadId: this.threadId,
        threadIdType: typeof this.threadId,
      })

      this.initialized = true
    } catch (error) {
      console.error('Error initializing ResumeChatManager:', error)
      throw new Error('Failed to initialize resume analysis')
    }
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
        throw new Error(`Missing required IDs: threadId=${this.threadId}, assistantId=${this.assistantId}`)
      }

      console.error('[ResumeChatManager] About to run assistant:', {
        threadId: this.threadId,
        threadIdType: typeof this.threadId,
        threadIdIsUndefined: this.threadId === undefined,
        assistantId: this.assistantId,
        assistantIdType: typeof this.assistantId,
      })
      
      if (!this.threadId) {
        throw new Error(`threadId is ${this.threadId} (${typeof this.threadId}) before calling runAssistant`)
      }
      
      // Run assistant on the thread
      await this.client.runAssistant(this.threadId, this.assistantId)
      
      console.log('Getting messages from thread:', this.threadId)
      // Get messages from thread
      const messages = await this.client.getThreadMessages(this.threadId)
      
      console.log('Received messages:', messages.length)
      // Return the last assistant message (the analysis)
      const lastMessage = messages[messages.length - 1]?.content || 'Unable to analyze resume at this time.'
      console.log('Last message length:', lastMessage.length)
      return lastMessage
    } catch (error) {
      console.error('Error generating initial analysis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : String(error)
      console.error('Error details:', { errorMessage, errorStack, threadId: this.threadId, assistantId: this.assistantId })
      throw new Error(`Failed to generate resume analysis: ${errorMessage}`)
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

      // Add user message to thread, with additional context if provided
      const messageWithContext = additionalContext 
        ? `${lastUserMessage}\n\n[System context: ${additionalContext}]`
        : lastUserMessage
      
      await this.client.addMessageToThread(this.threadId!, messageWithContext)

      // Run assistant
      await this.client.runAssistant(this.threadId!, this.assistantId!)
      
      // Get messages from thread
      const messages = await this.client.getThreadMessages(this.threadId!)

      return messages[messages.length - 1]?.content || 'I apologize, but I could not generate a response at this time.'
    } catch (error) {
      console.error('Error generating response:', error)
      throw new Error('Failed to generate response')
    }
  }

  /**
   * Generate improved resume version
   */
  async generateImprovedResume(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      // Add request for improved resume - be explicit about preserving original data
      await this.client.addMessageToThread(
        this.threadId!,
        `Generate an improved version of this resume based on our conversation, following modern ATS-friendly resume best practices.

#1 RULE - NEVER EXCEED 1 PAGE (MOST IMPORTANT):
- The resume MUST fit on exactly 1 page - this is the absolute priority
- If content is too long, simplify and shorten components in this priority order (least important first):
  1. Older/less recent jobs (can reduce bullets from 4 to 3, or 3 to 2 if needed)
  2. Less impressive projects (can reduce bullets or shorten descriptions)
  3. Education section (can be more concise)
  4. Skills section (already optimized, but can reduce if absolutely necessary)
  5. Summary section (ONLY shorten as last resort - it's very important)
- NEVER remove entire jobs, projects, or education entries - only shorten them
- Make ALL bullets as concise as possible (1 line, ~70-90 chars max) to save space
- Prioritize recent experience and most impressive projects

CRITICAL: PRESERVE ALL ORIGINAL DATA EXACTLY
- Use the EXACT information from the original resume file
- Keep ALL project names, company names, dates, technologies exactly as they appear
- Preserve the same structure and sections
- Only improve WORDING and FORMATTING, not the facts

PROJECT PRIORITIZATION (MANDATORY):
- Order projects by impressiveness/advancement - most impressive at the top, least at the bottom
- Consider: Full-stack apps > static sites, AI/ML features > basic, Complex integrations > simple, Modern tech > older tech
- Most impressive project = first, least impressive = last

DO NOT:
- Change project names (e.g., "NOMADAI" stays "NOMADAI")
- Change company names or locations
- Change dates or time periods
- Add metrics or achievements that weren't in the original
- Exceed 1 page - if needed, shorten least important sections

DO:
- Improve wording for clarity and impact
- Make bullets as concise as possible (1 line, ~70-90 chars max)
- Preserve as many bullet points as possible, but reduce in older/less important positions if needed for 1 page
- Professional Summary: Keep it 3-5 sentences minimum (50-80 words) - it's very important and should be comprehensive
- Skills: MANDATORY optimization (12-16 most relevant):
  * REMOVE duplicates: "Git" + "GitHub" → "Git/GitHub"
  * REMOVE duplicates: "React" + "Vite" + "Next.js" → "React (Vite, Next.js)"
  * REMOVE redundant: "Version Control" if "Git/GitHub" exists
  * REMOVE skills not related to role (e.g., audio tools for web dev role)
  * ADD missing skills from projects/jobs (e.g., "Firebase" if used in projects)
  * GROUP related skills: "React (Vite, Next.js)", "CSS (Tailwind, shadcn/ui)"
  * Prioritize hard skills relevant to the role
  * DO NOT just copy original - MUST optimize intelligently
- Format consistently for ATS optimization
- Order projects by impressiveness (most impressive first)

PROFESSIONAL SUMMARY (VERY IMPORTANT - MINIMUM LENGTH REQUIRED):
- The professional summary is very important and should be comprehensive
- Minimum length: 3-5 sentences (50-80 words minimum)
- If the original has a summary, preserve its core content and expand/improve it to meet minimum length
- If no summary exists, create a comprehensive one based on the actual content in the resume
- Should cover: role title, years of experience, core competencies (3-5), key achievements, and what you bring
- Only shorten below minimum as an absolute last resort if nothing else can be shortened for 1 page

Include ALL content from the original:
- ALL work experience positions (keep exact order, preserve bullets but shorten if needed for 1 page)
- ALL projects (order by impressiveness, preserve bullets but shorten if needed for 1 page)
- ALL education entries (keep exact names and dates, can be more concise)
- Skills: 12-16 most relevant (prioritize job-relevant ones, optimize as instructed)

REMEMBER: 1 PAGE IS MANDATORY. If you must choose between preserving all bullets vs fitting on 1 page, choose 1 page and shorten least important components.

Return the complete improved resume text with ALL the REAL information from the original resume preserved exactly, only with improved wording and formatting, fitting on exactly 1 page.`
      )

      // Run assistant
      await this.client.runAssistant(this.threadId!, this.assistantId!)
      
      // Get messages from thread
      const messages = await this.client.getThreadMessages(this.threadId!)

      return messages[messages.length - 1]?.content || ''
    } catch (error) {
      console.error('Error generating improved resume:', error)
      throw new Error('Failed to generate improved resume')
    }
  }

  /**
   * Generate HTML resume internally (for PDF conversion, not for chat)
   */
  async generateHTMLResumeInternal(
    improvedResumeText: string
  ): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      // Ask AI to convert the improved resume text into styled HTML
      await this.client.addMessageToThread(
        this.threadId!,
        `Convert this resume into a complete, professionally styled HTML document with inline CSS. Use the actual information provided - no placeholders.

Resume content:
${improvedResumeText}

Requirements:
- Complete HTML document with <!DOCTYPE html>, <head>, and <body>
- Inline CSS styling (modern, clean, professional design)
- Use actual data from the resume above - NO placeholders like [Your Name]
- Proper semantic HTML structure (header, sections, etc.)
- Print-friendly styling
- ATS-friendly formatting
- Professional color scheme (blues, grays work well)
- Good typography and spacing

Return ONLY the HTML code starting with <!DOCTYPE html> and ending with </html>. No explanations, no markdown code blocks, just the raw HTML.`
      )

      await this.client.runAssistant(this.threadId!, this.assistantId!)
      const messages = await this.client.getThreadMessages(this.threadId!)

      let htmlContent = messages[messages.length - 1]?.content || ''
      
      // Clean up markdown code blocks if present
      htmlContent = htmlContent
        .replace(/^```html\n?/i, '')
        .replace(/^```\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()

      return htmlContent
    } catch (error) {
      console.error('Error generating HTML resume:', error)
      throw new Error('Failed to generate HTML resume')
    }
  }

  /**
   * Get OpenAI IDs for persistence (to avoid re-uploading)
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

  /**
   * Initialize with existing OpenAI IDs (if session was already initialized)
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
}


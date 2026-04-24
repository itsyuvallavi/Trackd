/**
 * Base AI Client with retry logic and error handling
 * 
 * Provides a wrapper around OpenAI API with:
 * - Automatic retries for transient errors
 * - Rate limiting
 * - Cost tracking
 * - Error handling
 */

import OpenAI from 'openai'
import { getAIConfig, getResumeAIConfig, calculateCost } from './config'
import { AIConfig } from './types'
import { AIResponse } from './types'

/**
 * GPT-5 family and O-series reject `max_tokens`; they require `max_completion_tokens`.
 * @see https://platform.openai.com/docs/guides/migrating-to-new-models
 */
function tokenLimitCreateParams(
  model: string,
  maxTokens: number | undefined
): { max_tokens: number } | { max_completion_tokens: number } | Record<string, never> {
  if (maxTokens == null) return {}
  const m = model.toLowerCase()
  const useCompletionCap = m.includes('gpt-5') || /^o[0-9]/.test(m)
  return useCompletionCap
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens }
}

export class AIClient {
  private client: OpenAI
  private config: AIConfig
  private requestCount: number = 0
  private totalCost: number = 0

  constructor(config?: AIConfig) {
    this.config = config || getAIConfig()
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    })
  }

  /**
   * Make a chat completion request with retry logic
   */
  async chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number
      maxTokens?: number
      model?: string // Allow overriding model per request
      responseFormat?: 'json_object' | 'text' // Allow choosing response format
    }
  ): Promise<AIResponse<OpenAI.Chat.Completions.ChatCompletion>> {
    const startTime = Date.now()
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const resolvedModel = options?.model ?? this.config.model
        const resolvedTemp = options?.temperature ?? this.config.temperature
        // Reasoning / o-series models and some newer models (e.g. gpt-5-mini) only
        // accept the default temperature (1). Omit the parameter entirely for those models
        // so the API doesn't reject the request with a 400.
        const supportsCustomTemp = !/^(o1|o3|o4|gpt-5)/i.test(resolvedModel)
        const response = await this.client.chat.completions.create({
          model: resolvedModel,
          messages,
          ...(supportsCustomTemp ? { temperature: resolvedTemp } : {}),
          ...tokenLimitCreateParams(resolvedModel, options?.maxTokens),
          response_format: options?.responseFormat === 'text' 
            ? undefined 
            : { type: 'json_object' }, // Default to JSON, allow text for resume generation
        })

        const usage = response.usage
        const cost = usage
          ? calculateCost(options?.model ?? this.config.model, usage.prompt_tokens, usage.completion_tokens)
          : 0

        this.requestCount++
        this.totalCost += cost

        return {
          data: response,
          usage: usage
            ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
              }
            : undefined,
          cost,
        }
      } catch (error) {
        lastError = error as Error

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error as Error)
        const isLastAttempt = attempt === this.config.maxRetries

        if (!isRetryable || isLastAttempt) {
          throw this.createAIError(error as Error, isRetryable)
        }

        // Exponential backoff: wait 2^attempt seconds
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await this.sleep(delay)
      }
    }

    throw this.createAIError(lastError || new Error('Unknown error'), false)
  }

  /**
   * Streaming chat completion (collect full text; use for TTFB-sensitive routes
   * that can pipe `ReadableStream` to the client later).
   */
  async *chatCompletionStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      model?: string
      maxTokens?: number
    }
  ): AsyncGenerator<string, void, undefined> {
    const resolvedModel = options?.model ?? this.config.model
    const stream = await this.client.chat.completions.create({
      model: resolvedModel,
      messages,
      stream: true,
      ...tokenLimitCreateParams(resolvedModel, options?.maxTokens),
    })

    for await (const chunk of stream) {
      const t = chunk.choices[0]?.delta?.content
      if (t) yield t
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Network errors, timeouts, and rate limits are retryable
    if (error.message.includes('timeout')) return true
    if (error.message.includes('ECONNRESET')) return true
    if (error.message.includes('rate limit')) return true
    if (error.message.includes('429')) return true

    // OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      // Rate limit errors
      if (error.status === 429) return true
      // Server errors (5xx)
      if (error.status && error.status >= 500) return true
    }

    return false
  }

  /**
   * Throw a real Error so callers and logs see a message (plain AIError objects stringify as [object Object]).
   */
  private createAIError(error: Error, retryable: boolean): never {
    const e = new Error(error.message)
    ;(e as Error & { code?: string; retryable: boolean }).retryable = retryable
    if (error instanceof OpenAI.APIError && error.code != null) {
      ;(e as Error & { code?: string }).code = String(error.code)
    }
    throw e
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get statistics about API usage
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      totalCost: this.totalCost,
      averageCostPerRequest:
        this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
    }
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats() {
    this.requestCount = 0
    this.totalCost = 0
  }

  /**
   * Upload a file to OpenAI
   */
  async uploadFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    try {
      // Convert Buffer to Uint8Array for File constructor
      const uint8Array = new Uint8Array(fileBuffer)
      const file = new File([uint8Array], fileName)
      
      const uploadedFile = await this.client.files.create({
        file: file,
        purpose: 'assistants',
      })
      
      // Wait for file to be processed (status should be 'processed')
      let fileStatus = await this.client.files.retrieve(uploadedFile.id)
      let attempts = 0
      const maxAttempts = 30 // Wait up to 30 seconds
      
      while (fileStatus.status !== 'processed' && attempts < maxAttempts) {
        if (fileStatus.status === 'error') {
          throw new Error(`File processing failed: Unknown error`)
        }
        await this.sleep(1000)
        fileStatus = await this.client.files.retrieve(uploadedFile.id)
        attempts++
      }
      
      if (fileStatus.status !== 'processed') {
        throw new Error(`File processing timed out. Status: ${fileStatus.status}`)
      }
      
      return uploadedFile.id
    } catch (error) {
      console.error('Error uploading file to OpenAI:', error)
      throw error
    }
  }

  /**
   * Create an assistant with file access
   * Files are attached to messages, so assistant just needs file_search tool enabled
   */
  async createAssistantWithFile(
    fileId: string,
    instructions: string
  ): Promise<string> {
    try {
      // Create assistant with file_search tool enabled
      // Files will be attached to messages, so assistant can access them
      const assistant = await this.client.beta.assistants.create({
        model: this.config.model,
        instructions,
        tools: [{ type: 'file_search' }],
      })
      console.log('Created assistant:', assistant.id)
      return assistant.id
    } catch (error) {
      console.error('Error creating assistant:', error)
      throw error
    }
  }

  /**
   * Create a thread with a file
   */
  async createThreadWithFile(
    fileId: string,
    message: string
  ): Promise<string> {
    try {
      console.log('Creating thread with file:', fileId)
      const thread = await this.client.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: message,
            attachments: [
              {
                file_id: fileId,
                tools: [{ type: 'file_search' }],
              },
            ],
          },
        ],
      })
      console.log('Created thread:', thread.id)
      return thread.id
    } catch (error) {
      console.error('Error creating thread:', error)
      throw error
    }
  }

  /**
   * Add a message to an existing thread
   */
  async addMessageToThread(
    threadId: string,
    message: string
  ): Promise<void> {
    await this.client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message,
    })
  }

  /**
   * Run assistant on a thread
   */
  async runAssistant(
    threadId: string,
    assistantId: string
  ): Promise<string> {
    try {
      if (!threadId || !assistantId) {
        throw new Error(`Invalid parameters: threadId=${threadId}, assistantId=${assistantId}`)
      }
      
      console.log('[runAssistant] Creating run for thread:', threadId)
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
      })
      console.log('[runAssistant] Run created:', run.id, 'status:', run.status)

      if (!run.id) {
        throw new Error('Run ID is missing from create response')
      }
      
      // Poll for completion
      // SDK v6 signature: retrieve(runId, { thread_id })
      let runStatus = await this.client.beta.threads.runs.retrieve(
        run.id,
        { thread_id: threadId }
      )
      console.log('[runAssistant] Initial run status:', runStatus.status)

      let pollCount = 0
      const maxPolls = 60 // Wait up to 60 seconds
      while ((runStatus.status === 'queued' || runStatus.status === 'in_progress') && pollCount < maxPolls) {
        await this.sleep(1000)
        pollCount++
        
        runStatus = await this.client.beta.threads.runs.retrieve(
          run.id,
          { thread_id: threadId }
        )
        
        if (pollCount % 5 === 0) {
          console.log(`[runAssistant] Polling... status: ${runStatus.status} (${pollCount}s)`)
        }
      }

      console.log('Final run status:', runStatus.status)
      if (runStatus.status === 'completed') {
        return run.id
      }

      // Log more details about the failure
      if (runStatus.status === 'failed') {
        const lastError = runStatus.last_error
        console.error('Run failed with error:', lastError)
        throw new Error(`Run failed: ${lastError?.message || 'Unknown error'}. Code: ${lastError?.code}`)
      }

      if (pollCount >= maxPolls) {
        throw new Error(`Run timed out after ${maxPolls} seconds. Status: ${runStatus.status}`)
      }

      throw new Error(`Run failed with status: ${runStatus.status}`)
    } catch (error) {
      console.error('Error in runAssistant:', error)
      throw error
    }
  }

  /**
   * Get messages from a thread
   */
  async getThreadMessages(threadId: string): Promise<Array<{
    role: 'user' | 'assistant'
    content: string
  }>> {
    try {
      console.log('Fetching messages from thread:', threadId)
      const messages = await this.client.beta.threads.messages.list(threadId)
      console.log('Total messages received:', messages.data.length)
      
      const processedMessages = messages.data
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => {
          // Handle different content types
          let content = ''
          if (msg.content && msg.content.length > 0) {
            const firstContent = msg.content[0]
            if (firstContent.type === 'text') {
              content = firstContent.text.value
            } else if (firstContent.type === 'image_file') {
              content = '[Image file attached]'
            } else {
              content = `[${firstContent.type} content]`
            }
          }
          return {
            role: msg.role as 'user' | 'assistant',
            content,
          }
        })
        .reverse()
      
      console.log('Processed messages:', processedMessages.length)
      return processedMessages
    } catch (error) {
      console.error('Error getting thread messages:', error)
      throw error
    }
  }

  /**
   * Expose the OpenAI client for direct access when needed
   */
  getOpenAIClient(): OpenAI {
    return this.client
  }
}

// Singleton instances
let aiClientInstance: AIClient | null = null
let resumeAIClientInstance: AIClient | null = null

/**
 * Get or create the AI client singleton (default: gpt-4o-mini for email sync, interview prep)
 */
export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient()
  }
  return aiClientInstance
}

/**
 * Get or create the resume AI client singleton (gpt-4o for more robust resume analysis)
 */
export function getResumeAIClient(): AIClient {
  if (!resumeAIClientInstance) {
    resumeAIClientInstance = new AIClient(getResumeAIConfig())
  }
  return resumeAIClientInstance
}


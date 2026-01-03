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
import { getAIConfig, calculateCost } from './config'
import { AIResponse, AIError } from './types'

export class AIClient {
  private client: OpenAI
  private config: ReturnType<typeof getAIConfig>
  private requestCount: number = 0
  private totalCost: number = 0

  constructor() {
    this.config = getAIConfig()
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
    }
  ): Promise<AIResponse<OpenAI.Chat.Completions.ChatCompletion>> {
    const startTime = Date.now()
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          messages,
          temperature: options?.temperature ?? this.config.temperature,
          max_tokens: options?.maxTokens,
          response_format: { type: 'json_object' }, // Force JSON response
        })

        const usage = response.usage
        const cost = usage
          ? calculateCost(usage.prompt_tokens, usage.completion_tokens)
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
   * Create a standardized AI error
   */
  private createAIError(error: Error, retryable: boolean): AIError {
    return {
      message: error.message,
      code: error instanceof OpenAI.APIError ? (error.code ?? undefined) : undefined,
      retryable,
    }
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
}

// Singleton instance
let aiClientInstance: AIClient | null = null

/**
 * Get or create the AI client singleton
 */
export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient()
  }
  return aiClientInstance
}


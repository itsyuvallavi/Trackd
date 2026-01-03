/**
 * AI Configuration
 * 
 * Configuration for OpenAI GPT-4o-mini model
 */

import { AIConfig } from './types'

/**
 * Get AI configuration from environment variables
 */
export function getAIConfig(): AIConfig {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
      'Please set it in your .env file.'
    )
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.AI_TIMEOUT || '30000', 10), // 30 seconds
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'), // Lower temperature for more consistent results
  }
}

/**
 * Calculate cost based on token usage
 * GPT-4o-mini pricing (as of 2025):
 * - Input: $0.15 per 1M tokens
 * - Output: $0.60 per 1M tokens
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number
): number {
  const INPUT_COST_PER_MILLION = 0.15
  const OUTPUT_COST_PER_MILLION = 0.60

  const inputCost = (promptTokens / 1_000_000) * INPUT_COST_PER_MILLION
  const outputCost = (completionTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

  return inputCost + outputCost
}


/**
 * AI Configuration
 * 
 * Configuration for OpenAI models
 * - Default (email sync, interview prep): GPT-4o-mini (cost-effective)
 * - Resume feature: GPT-4o-mini (cost-effective, sufficient with good prompts)
 * 
 * Both features use gpt-4o-mini by default for optimal cost efficiency.
 * Can override via environment variables if needed.
 */

import { AIConfig } from './types'

/**
 * Get AI configuration from environment variables
 * Default model: gpt-4o-mini (for email sync, interview prep, etc.)
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
 * Get AI configuration for resume feature
 * 
 * Model options (cost per 1M tokens):
 * - gpt-4o-mini: $0.75 total (input $0.15 + output $0.60) - 16x cheaper than GPT-4o
 * - o3-mini: $5.50 total (input $1.10 + output $4.40) - 2.3x cheaper than GPT-4o, better reasoning
 * - gpt-4o: $12.50 total (input $2.50 + output $10.00) - highest quality but most expensive
 * 
 * Recommendation: gpt-4o-mini is sufficient for resume generation with good prompts
 * Set RESUME_AI_MODEL=gpt-4o-mini for cost efficiency, or gpt-4o for maximum quality
 */
/**
 * Job-application automation uses two roles (can be the same model):
 *
 * - **Plan** (one JSON plan per scan): needs strong instruction-following — default `gpt-4o`.
 * - **Field** (many small `answerCustomField` calls): default `gpt-4o-mini` to save cost.
 *
 * Env vars (optional splits):
 * - `OPENAI_APPLY_PLAN_MODEL` — planner only; falls back to `OPENAI_APPLY_MODEL`, then `gpt-4o`.
 * - `OPENAI_APPLY_FIELD_MODEL` — per-field answers; falls back to `OPENAI_APPLY_MODEL`, then `gpt-4o-mini`.
 * - `OPENAI_APPLY_MODEL` — if set and the split vars are not, both roles use this (legacy single knob).
 */
export function getApplyPlanModel(): string {
  return (
    process.env.OPENAI_APPLY_PLAN_MODEL?.trim() ||
    process.env.OPENAI_APPLY_MODEL?.trim() ||
    'gpt-4o'
  )
}

export function getApplyFieldModel(): string {
  return (
    process.env.OPENAI_APPLY_FIELD_MODEL?.trim() ||
    process.env.OPENAI_APPLY_MODEL?.trim() ||
    'gpt-4o-mini'
  )
}

/** @deprecated Prefer getApplyPlanModel() or getApplyFieldModel(). */
export function getApplyAIModel(): string {
  return getApplyPlanModel()
}

export function getApplyAIConfig(): AIConfig {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' + 'Please set it in your .env file.'
    )
  }

  return {
    apiKey,
    model: getApplyPlanModel(),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.OPENAI_APPLY_TIMEOUT_MS || '120000', 10),
    temperature: parseFloat(process.env.OPENAI_APPLY_TEMPERATURE || '0.25'),
  }
}

export function getResumeAIConfig(): AIConfig {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
      'Please set it in your .env file.'
    )
  }

  return {
    apiKey,
    // Default to gpt-4o-mini for cost efficiency (16x cheaper than gpt-4o)
    // Can override with RESUME_AI_MODEL env var: gpt-4o-mini, o3-mini, or gpt-4o
    model: process.env.RESUME_AI_MODEL || 'gpt-4o-mini',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.RESUME_AI_TIMEOUT || '60000', 10), // 60 seconds for resume (longer processing)
    temperature: parseFloat(process.env.RESUME_AI_TEMPERATURE || '0.3'),
  }
}

/**
 * Calculate cost based on token usage and model
 * Pricing as of 2025 (per 1M tokens):
 * 
 * GPT-4o-mini:
 * - Input: $0.15, Output: $0.60
 * 
 * GPT-4o:
 * - Input: $2.50, Output: $10.00
 * 
 * o3-mini (reasoning model):
 * - Input: $1.10, Output: $4.40
 * 
 * GPT-4.1 (if available):
 * - Input: $2.00, Output: $8.00
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  let INPUT_COST_PER_MILLION: number
  let OUTPUT_COST_PER_MILLION: number

  if (model.includes('gpt-4o-mini')) {
    INPUT_COST_PER_MILLION = 0.15
    OUTPUT_COST_PER_MILLION = 0.60
  } else if (model.includes('o3-mini')) {
    INPUT_COST_PER_MILLION = 1.10
    OUTPUT_COST_PER_MILLION = 4.40
  } else if (model.includes('gpt-4.1')) {
    INPUT_COST_PER_MILLION = 2.00
    OUTPUT_COST_PER_MILLION = 8.00
  } else if (model.includes('gpt-5.4-mini')) {
    INPUT_COST_PER_MILLION = 0.75
    OUTPUT_COST_PER_MILLION = 4.5
  } else if (model.includes('gpt-5.4-nano')) {
    INPUT_COST_PER_MILLION = 0.2
    OUTPUT_COST_PER_MILLION = 1.25
  } else if (model.includes('gpt-5.4')) {
    INPUT_COST_PER_MILLION = 2.5
    OUTPUT_COST_PER_MILLION = 15.0
  } else if (model.includes('gpt-4o')) {
    INPUT_COST_PER_MILLION = 2.50
    OUTPUT_COST_PER_MILLION = 10.00
  } else {
    // Default to gpt-4o-mini pricing for unknown models
    console.warn(`Unknown AI model: ${model}. Using gpt-4o-mini pricing for cost calculation.`)
    INPUT_COST_PER_MILLION = 0.15
    OUTPUT_COST_PER_MILLION = 0.60
  }

  const inputCost = (promptTokens / 1_000_000) * INPUT_COST_PER_MILLION
  const outputCost = (completionTokens / 1_000_000) * OUTPUT_COST_PER_MILLION

  return inputCost + outputCost
}


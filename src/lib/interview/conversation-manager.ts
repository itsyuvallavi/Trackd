/**
 * Conversation Manager
 * 
 * Manages AI interview conversation flow, question generation,
 * response analysis, and summary generation
 */

import { getAIClient } from '../ai/client'
import { InterviewType } from '@prisma/client'
import {
  InterviewMessage,
  JobContext,
  QuestionResponse,
  ResponseAnalysis,
  SessionSummary,
} from './types'
import {
  getInterviewSystemPrompt,
  getQuestionGenerationPrompt,
  getResponseAnalysisPrompt,
  getSummaryPrompt,
} from './prompts'

export class ConversationManager {
  private client = getAIClient()
  private sessionId: string
  private jobContext?: JobContext
  private interviewType: InterviewType
  private systemPrompt: string

  constructor(
    sessionId: string,
    interviewType: InterviewType,
    jobContext?: JobContext
  ) {
    this.sessionId = sessionId
    this.jobContext = jobContext
    this.interviewType = interviewType
    this.systemPrompt = getInterviewSystemPrompt(interviewType, jobContext)
  }

  /**
   * Generate next question based on conversation history
   */
  async generateNextQuestion(
    conversationHistory: InterviewMessage[]
  ): Promise<QuestionResponse> {
    try {
      const questionCount = conversationHistory.filter(
        (m) => m.role === 'assistant'
      ).length

      const prompt = getQuestionGenerationPrompt(
        conversationHistory,
        this.interviewType,
        questionCount
      )

      // Build messages array with system prompt and conversation history
      const messages: Array<{
        role: 'system' | 'user' | 'assistant'
        content: string
      }> = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        { role: 'user', content: prompt },
      ]

      const response = await this.client.chatCompletion(messages, {
        temperature: 0.8, // Higher temperature for more natural conversation
        maxTokens: 500,
        responseFormat: { type: 'json_object' },
      })

      if (!response.data.choices[0]?.message?.content) {
        throw new Error('No response from AI')
      }

      const content = response.data.choices[0].message.content
      let parsed: {
        question: string
        type: string
        hints?: string[]
      }
      
      try {
        parsed = JSON.parse(content)
      } catch (error) {
        // If JSON parsing fails, try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1])
        } else {
          // Fallback: treat entire content as question
          parsed = {
            question: content.trim(),
            type: 'general',
          }
        }
      }

      return {
        question: parsed.question,
        type: parsed.type,
        feedback: parsed.hints ? { hints: parsed.hints } : undefined,
      }
    } catch (error) {
      console.error('Error generating question:', error)
      throw new Error('Failed to generate interview question')
    }
  }

  /**
   * Analyze user response and provide feedback
   */
  async analyzeResponse(
    question: string,
    userResponse: string,
    questionType: string
  ): Promise<ResponseAnalysis> {
    try {
      const prompt = getResponseAnalysisPrompt(question, userResponse, questionType)

      const messages: Array<{
        role: 'system' | 'user' | 'assistant'
        content: string
      }> = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt },
      ]

      const response = await this.client.chatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 400,
        responseFormat: { type: 'json_object' },
      })

      if (!response.data.choices[0]?.message?.content) {
        throw new Error('No response from AI')
      }

      const content = response.data.choices[0].message.content
      let parsed: {
        feedback: string
        score?: number
        strengths?: string[]
        suggestions?: string[]
        followUp?: string
      }
      
      try {
        parsed = JSON.parse(content)
      } catch (error) {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1])
        } else {
          parsed = {
            feedback: content.trim(),
          }
        }
      }

      return {
        feedback: parsed.feedback,
        score: parsed.score,
        suggestions: parsed.suggestions,
      }
    } catch (error) {
      console.error('Error analyzing response:', error)
      throw new Error('Failed to analyze response')
    }
  }

  /**
   * Generate comprehensive session summary
   */
  async generateSummary(messages: InterviewMessage[]): Promise<SessionSummary> {
    try {
      const prompt = getSummaryPrompt(messages)

      const messagesArray: Array<{
        role: 'system' | 'user' | 'assistant'
        content: string
      }> = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt },
      ]

      const response = await this.client.chatCompletion(messagesArray, {
        temperature: 0.7,
        maxTokens: 1500,
        responseFormat: { type: 'json_object' },
      })

      if (!response.data.choices[0]?.message?.content) {
        throw new Error('No response from AI')
      }

      const content = response.data.choices[0].message.content
      let parsed: {
        summary: string
        strengths: string[]
        improvements: string[]
        tips: string[]
      }
      
      try {
        parsed = JSON.parse(content)
      } catch (error) {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1])
        } else {
          throw new Error('Failed to parse summary response')
        }
      }

      return {
        summary: parsed.summary,
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
        tips: parsed.tips || [],
      }
    } catch (error) {
      console.error('Error generating summary:', error)
      throw new Error('Failed to generate session summary')
    }
  }
}


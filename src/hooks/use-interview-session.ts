'use client'

import { useState, useEffect, useCallback } from 'react'
import { InterviewMessage } from '@/lib/interview/types'
import { VoiceService } from '@/lib/interview/voice-service'

interface UseInterviewSessionOptions {
  sessionId: string
  onQuestionGenerated?: (question: string) => void
  onResponseAnalyzed?: (analysis: any) => void
}

export function useInterviewSession({
  sessionId,
  onQuestionGenerated,
  onResponseAnalyzed,
}: UseInterviewSessionOptions) {
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [voiceService] = useState(() => new VoiceService())

  // Load messages on mount
  useEffect(() => {
    loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/interview/sessions/${sessionId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
        
        // Set current question if last message is assistant
        const lastMessage = data.messages?.[data.messages.length - 1]
        if (lastMessage?.role === 'assistant') {
          setCurrentQuestion(lastMessage.content)
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const saveMessage = useCallback(async (
    role: 'user' | 'assistant',
    content: string,
    options?: {
      audioUrl?: string
      duration?: number
      questionType?: string
      feedback?: any
    }
  ) => {
    try {
      const response = await fetch(`/api/interview/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          ...options,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessages((prev) => [...prev, data.message])
        return data.message
      }
    } catch (error) {
      console.error('Error saving message:', error)
    }
  }, [sessionId])

  const analyzeResponse = useCallback(async (question: string, response: string) => {
    setIsLoading(true)
    try {
      const analyzeRes = await fetch(`/api/interview/sessions/${sessionId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          response,
        }),
      })

      if (analyzeRes.ok) {
        const data = await analyzeRes.json()
        if (onResponseAnalyzed) {
          onResponseAnalyzed(data.analysis)
        }
        return data.analysis
      }
    } catch (error) {
      console.error('Error analyzing response:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, onResponseAnalyzed])

  const startListening = useCallback(() => {
    if (!voiceService.isSupported()) {
      alert('Voice recognition is not supported in your browser')
      return
    }

    setIsListening(true)
    voiceService.startListening(
      async (text) => {
        // Save user message
        await saveMessage('user', text)
        setIsListening(false)
        
        // Analyze response if there's a current question
        if (currentQuestion) {
          await analyzeResponse(currentQuestion, text)
        }
      },
      (error) => {
        console.error('Speech recognition error:', error)
        setIsListening(false)
      }
    )
  }, [currentQuestion, saveMessage, analyzeResponse, voiceService])

  const stopListening = useCallback(() => {
    voiceService.stopListening()
    setIsListening(false)
  }, [voiceService])

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true)
    try {
      await voiceService.speak(text, { rate: 0.9, pitch: 1.0 })
    } catch (error) {
      console.error('Error speaking:', error)
    } finally {
      setIsSpeaking(false)
    }
  }, [voiceService])

  const getNextQuestion = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/interview/sessions/${sessionId}/next-question`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        const question = data.question.question
        
        setCurrentQuestion(question)
        if (onQuestionGenerated) {
          onQuestionGenerated(question)
        }
        
        // Speak the question
        await speak(question)
        
        return question
      }
    } catch (error) {
      console.error('Error getting next question:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, onQuestionGenerated, speak])

  const generateSummary = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/interview/sessions/${sessionId}/summary`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        return data.summary
      }
    } catch (error) {
      console.error('Error generating summary:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  return {
    messages,
    isListening,
    isSpeaking,
    isLoading,
    currentQuestion,
    startListening,
    stopListening,
    speak,
    getNextQuestion,
    generateSummary,
    loadMessages,
  }
}

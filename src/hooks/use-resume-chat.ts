'use client'

import { useState, useCallback } from 'react'
import { ResumeMessage } from '@/lib/resume/types'

interface UseResumeChatOptions {
  sessionId: string
}

export function useResumeChat({ sessionId }: UseResumeChatOptions) {
  const [messages, setMessages] = useState<ResumeMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [resumeReadyMessageId, setResumeReadyMessageId] = useState<string | null>(null)

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/resume/chat/sessions/${sessionId}/messages`)
      if (response.ok) {
        const data = await response.json()
        const loadedMessages = data.messages || []
        setMessages(loadedMessages)
        
        // If session has improved resume, find the last assistant message to show the card
        if (data.hasImprovedResume && loadedMessages.length > 0) {
          const lastAssistantMsg = [...loadedMessages]
            .reverse()
            .find((m: ResumeMessage) => m.role === 'assistant')
          if (lastAssistantMsg) {
            setResumeReadyMessageId(lastAssistantMsg.id)
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }, [sessionId])

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true)
    
    // Optimistically add user message
    const userMessage: ResumeMessage = {
      id: `temp-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await fetch(`/api/resume/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Replace temp message with real one
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== userMessage.id)
          return [...filtered, data.userMessage, data.assistantMessage]
        })
        
        // If resume was generated, mark this assistant message to show the card
        if (data.resumeGenerated) {
          setResumeReadyMessageId(data.assistantMessage.id)
        }
      } else {
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  return {
    messages,
    isLoading,
    resumeReadyMessageId,
    sendMessage,
    loadMessages,
  }
}


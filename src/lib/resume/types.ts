export interface ResumeMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ResumeSession {
  id: string
  userId: string
  resumeText: string
  improvedResumeText?: string | null
  createdAt: Date
  updatedAt: Date
}


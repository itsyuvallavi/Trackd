/**
 * Voice Service - Web Speech API wrapper
 * 
 * Handles speech-to-text and text-to-speech using browser APIs
 */

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export class VoiceService {
  private recognition: any = null
  private synthesis: SpeechSynthesis
  private isListening: boolean = false
  private onResultCallback?: (text: string) => void
  private onErrorCallback?: (error: Error) => void

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis
      this.initializeRecognition()
    } else {
      this.synthesis = {} as SpeechSynthesis
    }
  }

  /**
   * Initialize Speech Recognition API
   */
  private initializeRecognition(): void {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported in this browser')
      return
    }

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript && this.onResultCallback) {
        this.onResultCallback(finalTranscript.trim())
      }
    }

    this.recognition.onerror = (event: any) => {
      const error = new Error(`Speech recognition error: ${event.error}`)
      if (this.onErrorCallback) {
        this.onErrorCallback(error)
      }
      this.isListening = false
    }

    this.recognition.onend = () => {
      this.isListening = false
    }
  }

  /**
   * Start listening for voice input
   */
  startListening(
    onResult: (text: string) => void,
    onError?: (error: Error) => void
  ): void {
    if (!this.recognition) {
      const error = new Error('Speech Recognition not supported')
      if (onError) onError(error)
      return
    }

    if (this.isListening) {
      this.stopListening()
    }

    this.onResultCallback = onResult
    this.onErrorCallback = onError
    this.isListening = true

    try {
      this.recognition.start()
    } catch (error) {
      // Already started, ignore
      console.warn('Recognition already started')
    }
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  /**
   * Speak text using Text-to-Speech
   */
  speak(
    text: string,
    options?: { rate?: number; pitch?: number; volume?: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !this.synthesis) {
        reject(new Error('Speech Synthesis not available'))
        return
      }

      // Cancel any ongoing speech
      this.stopSpeaking()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = options?.rate ?? 1.0
      utterance.pitch = options?.pitch ?? 1.0
      utterance.volume = options?.volume ?? 1.0
      utterance.lang = 'en-US'

      utterance.onend = () => resolve()
      utterance.onerror = (error) => reject(error)

      this.synthesis.speak(utterance)
    })
  }

  /**
   * Stop speaking
   */
  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel()
    }
  }

  /**
   * Check if voice services are supported
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false

    const hasRecognition =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    const hasSynthesis = 'speechSynthesis' in window

    return hasRecognition && hasSynthesis
  }

  /**
   * Get current listening state
   */
  getIsListening(): boolean {
    return this.isListening
  }
}





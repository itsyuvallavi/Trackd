'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResumeUploadProps {
  onResumeUploaded: (sessionId: string) => void
}

export function ResumeUpload({ onResumeUploaded }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    if (!file) return

    setIsUploading(true)
    try {
      // Upload file to server (handles all file types)
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to upload file' }))
        throw new Error(errorData.error || 'Failed to upload file')
      }
      
      const { session } = await response.json()
      if (!session?.id) {
        throw new Error('Invalid response from server')
      }
      
      // Pass sessionId to parent component
      onResumeUploaded(session.id)
    } catch (error) {
      console.error('Error uploading file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Error uploading file: ${errorMessage}. Please try again.`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div
      className={cn(
        'bg-background border border-border rounded-lg shadow-sm p-8 md:p-12 text-center transition-colors',
        dragActive
          ? 'border-primary bg-primary/5'
          : 'hover:border-primary/50',
        isUploading && 'opacity-50 pointer-events-none'
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.doc,.docx"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-12 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Uploading file...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Large Upload Icon */}
          <Upload className="size-16 md:size-20 text-foreground/60" />
          
          {/* Title */}
          <p className="text-base md:text-lg font-semibold text-foreground">
            Upload your resume
          </p>
          
          {/* Subtitle */}
          <p className="text-sm text-muted-foreground max-w-md">
            Drag and drop a file here, or click to browse
          </p>
          
          {/* Choose File Button */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="mt-2"
          >
            <FileText className="size-4 mr-2" />
            Choose File
          </Button>
          
          {/* Supported Formats */}
          <p className="text-xs text-muted-foreground mt-4">
            Supports: TXT, PDF, DOC, DOCX
          </p>
        </div>
      )}
    </div>
  )
}


'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResumeUploadProps {
  onResumeUploaded: (sessionId: string) => void
  /** When false, upload UI is inert (e.g. missing OPENAI_API_KEY). */
  disabled?: boolean
}

export function ResumeUpload({ onResumeUploaded, disabled = false }: ResumeUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    if (!file || disabled) return

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
    if (disabled) return
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
    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div
      className={cn(
        'glass glass-subtle rounded-2xl p-8 text-center relative overflow-hidden',
        'border border-dashed transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[var(--ease-ios)]',
        !disabled &&
          (dragActive
            ? 'border-primary/60 bg-primary/5 scale-[1.01] shadow-[0_0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.08)] trackd-glow-pulse'
            : 'hover:border-primary/40'),
        (isUploading || disabled) && 'opacity-60 pointer-events-none'
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
        disabled={disabled}
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Uploading file…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 rounded-2xl grid place-items-center bg-foreground/[0.04] border border-border/60">
            <Upload className="size-5 text-foreground/70" />
          </div>
          <p className="text-base font-medium tracking-tight text-foreground">
            Upload your resume
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Drag and drop a file here, or click to browse.
          </p>
          <Button
            onClick={() => !disabled && fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            className="mt-1 rounded-full"
            disabled={disabled}
          >
            <FileText className="size-3.5 mr-1.5" />
            Choose file
          </Button>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Supports TXT, PDF, DOC, DOCX.
          </p>
        </div>
      )}
    </div>
  )
}


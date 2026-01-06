'use client'

import { useState } from 'react'
import { FileText, Download, ExternalLink, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResumePreviewCardProps {
  sessionId: string
}

export function ResumePreviewCard({ sessionId }: ResumePreviewCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const handlePreview = () => {
    window.open(`/api/resume/chat/sessions/${sessionId}/preview`, '_blank')
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch(`/api/resume/chat/sessions/${sessionId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
        a.download = filenameMatch?.[1] || 'resume.pdf'
        
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setDownloadSuccess(true)
        setTimeout(() => setDownloadSuccess(false), 2000)
      } else {
        console.error('Download failed')
      }
    } catch (error) {
      console.error('Error downloading resume:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-4 max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-medium text-sm">Your Improved Resume</h4>
          <p className="text-xs text-muted-foreground">Ready to preview and download</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          className="flex-1 h-9 text-xs bg-background hover:bg-muted"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          Preview PDF
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className={cn(
            "flex-1 h-9 text-xs",
            downloadSuccess && "bg-green-600 hover:bg-green-600"
          )}
        >
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : downloadSuccess ? (
            <Check className="w-3.5 h-3.5 mr-1.5" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          {downloadSuccess ? 'Downloaded!' : 'Download'}
        </Button>
      </div>
    </div>
  )
}


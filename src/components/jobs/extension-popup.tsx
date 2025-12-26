'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Puzzle, X, Download } from 'lucide-react'

export function ExtensionPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Show popup when component mounts (only once)
  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('trackd-extension-popup-dismissed')
    if (!hasSeenPopup) {
      setIsOpen(true)
    }
  }, [])

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/download-extension')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'trackd-extension.zip'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      // Show the guide
      setShowGuide(true)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to download extension:', error)
    }
  }

  const handleDismiss = () => {
    setIsOpen(false)
    localStorage.setItem('trackd-extension-popup-dismissed', 'true')
  }

  const handleCloseGuide = () => {
    setShowGuide(false)
    localStorage.setItem('trackd-extension-popup-dismissed', 'true')
  }

  if (!isOpen && !showGuide) return null

  if (showGuide) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">How to Install & Use the Extension</h2>
            <button
              onClick={handleCloseGuide}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <h3 className="font-semibold text-lg">Install the Extension</h3>
              </div>
              <div className="pl-11 space-y-2 text-sm text-muted-foreground">
                <p><strong>Chrome/Edge/Brave:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Open <code className="bg-accent px-1 rounded">chrome://extensions/</code></li>
                  <li>Enable "Developer mode" (toggle in top right)</li>
                  <li>Click "Load unpacked"</li>
                  <li>Select the extracted extension folder</li>
                </ul>
                <p className="mt-3"><strong>Firefox:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Open <code className="bg-accent px-1 rounded">about:debugging#/runtime/this-firefox</code></li>
                  <li>Click "Load Temporary Add-on"</li>
                  <li>Select the <code className="bg-accent px-1 rounded">manifest.json</code> file</li>
                </ul>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <h3 className="font-semibold text-lg">Navigate to a Job Posting</h3>
              </div>
              <div className="pl-11 space-y-2 text-sm text-muted-foreground">
                <p>Go to any job posting on LinkedIn, Indeed, or other job sites.</p>
                <div className="border border-border rounded-lg p-4 bg-accent/30 mt-3">
                  <p className="text-xs text-muted-foreground italic">
                    📸 Screenshot placeholder: Job posting page
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <h3 className="font-semibold text-lg">Click the Extension Icon</h3>
              </div>
              <div className="pl-11 space-y-2 text-sm text-muted-foreground">
                <p>Click the Trackd extension icon in your browser toolbar.</p>
                <div className="border border-border rounded-lg p-4 bg-accent/30 mt-3">
                  <p className="text-xs text-muted-foreground italic">
                    📸 Screenshot placeholder: Extension popup showing job details
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">4</span>
                </div>
                <h3 className="font-semibold text-lg">Review & Save</h3>
              </div>
              <div className="pl-11 space-y-2 text-sm text-muted-foreground">
                <p>Review the extracted job details, edit if needed, and click "Save Job". The job will appear in your tracker immediately!</p>
                <div className="border border-border rounded-lg p-4 bg-accent/30 mt-3">
                  <p className="text-xs text-muted-foreground italic">
                    📸 Screenshot placeholder: Extension popup with save button
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <Button onClick={handleCloseGuide} className="w-full" size="lg">
                Got it
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Puzzle className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Download Browser Extension</h3>
              <p className="text-sm text-muted-foreground mt-1">Optional feature</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="text-muted-foreground mb-6">
          Save jobs from any website with one click. Works on LinkedIn, Indeed, and most job sites.
        </p>

        <div className="flex gap-3">
          <Button onClick={handleDismiss} variant="outline" className="flex-1">
            Maybe later
          </Button>
          <Button onClick={handleDownload} className="flex-1">
            <Download className="size-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}


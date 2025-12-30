'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Puzzle, X, Download } from 'lucide-react'

export function ExtensionPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Show popup when component mounts (only once on first visit to jobs page)
  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('trackd-extension-popup-seen')
    console.log('[ExtensionPopup] Checking localStorage:', { hasSeenPopup })
    
    if (!hasSeenPopup) {
      console.log('[ExtensionPopup] Showing popup and marking as seen')
      setIsOpen(true)
      // Mark as seen immediately so it doesn't show again
      localStorage.setItem('trackd-extension-popup-seen', 'true')
    } else {
      console.log('[ExtensionPopup] Popup already seen, not showing')
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
  }

  const handleCloseGuide = () => {
    setShowGuide(false)
  }

  if (!isOpen && !showGuide) return null

  if (showGuide) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg max-w-lg w-full shadow-xl">
          <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Setup Instructions</h2>
            <button
              onClick={handleCloseGuide}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Step 1: Install Extension */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <h3 className="font-semibold">Install Extension</h3>
              </div>
              <div className="pl-9 text-sm text-muted-foreground">
                <p>Open <code className="bg-accent px-1.5 py-0.5 rounded text-xs">chrome://extensions/</code></p>
                <p>Enable "Developer mode" → Click "Load unpacked" → Select the extracted folder</p>
              </div>
            </div>

            {/* Step 2: Get API Key */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <h3 className="font-semibold">Get Your API Key</h3>
              </div>
              <div className="pl-9 text-sm text-muted-foreground space-y-2">
                <p>Go to <strong>Settings → Integrations</strong> in the web app</p>
                <p>Click <strong>"Generate Extension Key"</strong> and copy it</p>
              </div>
            </div>

            {/* Step 3: Connect Extension */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <h3 className="font-semibold">Connect Extension</h3>
              </div>
              <div className="pl-9 text-sm text-muted-foreground">
                <p>Click the Trackd extension icon → Paste your key → Click "Connect"</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <Button onClick={handleCloseGuide} className="w-full">
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


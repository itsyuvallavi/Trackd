'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Eye, EyeOff, RefreshCw, Chrome, Check, Download } from 'lucide-react'

interface ExtensionKeyData {
  keyPrefix: string | null
  lastUsedAt: string | null
}

interface ExtensionKeySectionProps {
  initialData: ExtensionKeyData | null
}

export function ExtensionKeySection({ initialData }: ExtensionKeySectionProps) {
  const [key, setKey] = useState<string | null>(null)
  const [keyPrefix, setKeyPrefix] = useState<string | null>(initialData?.keyPrefix || null)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(initialData?.lastUsedAt || null)
  const [showKey, setShowKey] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch current extension key data on mount
  useEffect(() => {
    async function fetchKeyData() {
      try {
        const res = await fetch('/api/extension/generate-key', { method: 'GET' })
        if (res.ok) {
          const data = await res.json()
          if (data.keyPrefix) {
            setKeyPrefix(data.keyPrefix)
            setLastUsedAt(data.lastUsedAt || null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch extension key data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Only fetch if we don't have initial data
    if (!initialData?.keyPrefix) {
      fetchKeyData()
    } else {
      setIsLoading(false)
    }
  }, [initialData])

  async function generateKey() {
    setIsGenerating(true)
    setCopied(false)
    try {
      const res = await fetch('/api/extension/generate-key', { method: 'POST' })
      if (!res.ok) {
        throw new Error('Failed to generate key')
      }
      const data = await res.json()
      setKey(data.key)
      setKeyPrefix(data.keyPrefix)
      setShowKey(true)
    } catch (error) {
      console.error('Error generating key:', error)
      alert('Failed to generate extension key. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  function copyKey() {
    if (key) {
      navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDownloadExtension() {
    window.location.href = '/api/download-extension'
  }

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <Chrome className="size-6 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Chrome Extension</h3>
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Chrome className="size-6" />
          <h3 className="text-lg font-semibold">Chrome Extension</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadExtension}
          className="flex items-center gap-2"
        >
          <Download className="size-4" />
          Download
        </Button>
      </div>

      {!keyPrefix && !key ? (
        // No key exists
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Connect the Trackd Chrome extension to save jobs with one click from any job board.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={generateKey} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Generate Extension Key
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadExtension}
              className="flex items-center justify-center gap-2"
            >
              <Download className="size-4" />
              Download Extension First
            </Button>
          </div>
        </div>
      ) : (
        // Key exists
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Your Extension Key
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm border border-border">
                {key && showKey ? key : `${keyPrefix}••••••••••••••••••••••`}
              </code>

              {key && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                    className="shrink-0"
                  >
                    {showKey ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyKey}
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4 mr-1 text-green-500" />
                        <span className="text-xs">Copied!</span>
                      </>
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </>
              )}
            </div>
            {!key && (
              <p className="text-xs text-muted-foreground mt-2">
                Key was previously generated. Click "Regenerate Key" to view it again (this will disconnect any currently connected extensions).
              </p>
            )}
          </div>

          {lastUsedAt && (
            <p className="text-sm text-muted-foreground">
              Last used: {new Date(lastUsedAt).toLocaleString()}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={generateKey}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Regenerate Key
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Regenerating will disconnect any currently connected extensions. Make sure to update your extension with the new key.
          </p>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-2">How to Connect:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                <button
                  onClick={handleDownloadExtension}
                  className="text-primary hover:underline"
                >
                  Download and install the Trackd Chrome extension
                </button>
              </li>
              <li>Go to <code className="px-1 py-0.5 bg-muted rounded text-xs">chrome://extensions/</code></li>
              <li>Enable "Developer mode" (toggle in top right)</li>
              <li>Click "Load unpacked" and select the extracted extension folder</li>
              <li>Click the extension icon and paste your extension key</li>
              <li>Start saving jobs with one click!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}


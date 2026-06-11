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
      <div className="glass glass-subtle rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Chrome className="size-5 text-primary" />
          <h3 className="text-base font-semibold tracking-tight">
            Browser extension connection
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="glass glass-subtle rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Chrome className="size-5 text-primary" />
              <h3 className="text-base font-semibold tracking-tight">
                Browser extension connection
              </h3>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                keyPrefix || key
                  ? 'border-success/30 bg-success/15 text-success'
                  : 'border-warning/30 bg-warning/15 text-warning-text'
              }`}>
                <span className="size-1.5 rounded-full bg-current" />
                {keyPrefix || key ? 'Key generated' : 'Setup needed'}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Install the Trackd extension, generate a connection key, then paste it into the extension popup.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={generateKey}
              disabled={isGenerating}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  {keyPrefix || key ? 'Regenerate connection key' : 'Generate connection key'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadExtension}
              className="flex items-center gap-2"
            >
              <Download className="size-4" />
              Download extension
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Connection key
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
                {key
                  ? showKey
                    ? key
                    : `${key.slice(0, 10)}••••••••••••••••••••••`
                  : keyPrefix
                    ? `${keyPrefix}••••••••••••••••••••••`
                    : 'Generate a key to connect the extension'}
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
            {!key && keyPrefix && (
              <p className="text-xs text-muted-foreground mt-2">
                A key already exists, but the full value is only shown when generated. Regenerate it to copy a fresh key.
              </p>
            )}
            {!key && !keyPrefix && (
              <p className="text-xs text-muted-foreground mt-2">
                No connection key exists yet. Generate one, then paste it into the extension.
              </p>
            )}

            {lastUsedAt && (
              <p className="mt-3 text-sm text-muted-foreground" suppressHydrationWarning>
                Last used: {new Date(lastUsedAt).toLocaleString()}
              </p>
            )}

            {(keyPrefix || key) && (
              <p className="mt-3 text-sm text-muted-foreground">
                Regenerating disconnects existing extension installs. Paste the new key into the extension after regenerating.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/25 p-4">
            <h4 className="text-sm font-medium mb-3">Connection setup</h4>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">1</span>
                <span>Download and load the extension from <code className="rounded bg-muted px-1 py-0.5 text-xs">chrome://extensions</code>.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">2</span>
                <span>Generate a connection key on this page.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">3</span>
                <span>Open the extension popup, paste the key, and click Connect.</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

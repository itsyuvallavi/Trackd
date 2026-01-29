'use client'

import { useState, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, Paperclip, Bookmark, Zap, AtSign, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResumeChatInputProps {
  onFileUpload?: (file: File) => void
  onSend?: (message: string) => void
  placeholder?: string
  isLoading?: boolean
}

export function ResumeChatInput({
  onFileUpload,
  onSend,
  placeholder = "Start Typing or Press 'Space' for AI or Press '/' for saved replies",
  isLoading = false,
}: ResumeChatInputProps) {
  const [input, setInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    if (onSend) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onFileUpload) {
      onFileUpload(file)
    }
  }

  return (
    <div className="relative">
      <div className="bg-background border border-border rounded-lg shadow-sm">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "min-h-[120px] max-h-[300px] resize-none rounded-lg",
            "bg-background border-0",
            "text-sm placeholder:text-muted-foreground",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "pb-16 pr-24"
          )}
          disabled={isLoading}
        />
        
        {/* Bottom Icons and Button */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 border-t border-border">
          {/* Left Icons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Add"
            >
              <Plus className="size-4" />
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Mention"
            >
              <AtSign className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Attach file"
            >
              <Paperclip className="size-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Saved replies"
            >
              <Bookmark className="size-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="AI suggestions"
            >
              <Zap className="size-4" />
            </button>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "rounded-lg px-4 py-2",
              "bg-foreground hover:bg-foreground/90 text-background",
              "shadow-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all"
            )}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : null}
            <span className="text-sm font-medium">Send</span>
            <Send className="size-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.doc,.docx"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}


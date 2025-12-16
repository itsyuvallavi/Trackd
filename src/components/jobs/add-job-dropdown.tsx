'use client'

import { useState } from 'react'
import { Plus, Link as LinkIcon, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import Link from 'next/link'

interface AddJobDropdownProps {
  onManualAdd: () => void
}

export function AddJobDropdown({ onManualAdd }: AddJobDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Tooltip content="Add job">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="ghost"
          size="sm"
          className="size-9 p-0 text-foreground hover:text-primary hover:bg-primary/10 border border-border/50 transition-all duration-200"
        >
          <Plus className="size-4" />
        </Button>
      </Tooltip>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-20 py-1 animate-in slide-in-from-top-2 fade-in duration-150">
            <Link
              href="/jobs/new-url"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <LinkIcon className="size-4" />
              <div>
                <div className="font-medium">From URL</div>
                <div className="text-xs text-muted-foreground">Paste job link</div>
              </div>
            </Link>

            <button
              onClick={() => {
                setIsOpen(false)
                onManualAdd()
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
            >
              <Edit3 className="size-4" />
              <div>
                <div className="font-medium">Manually</div>
                <div className="text-xs text-muted-foreground">Enter details</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

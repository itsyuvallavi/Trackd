'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FeedbackModal = dynamic(
  () => import('./feedback-modal').then((mod) => ({ default: mod.FeedbackModal })),
  { ssr: false }
)

export function FloatingFeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 size-12 group hidden md:flex"
        onClick={() => setIsOpen(true)}
        aria-label="Report an issue"
      >
        <MessageSquare className="size-5 group-hover:rotate-12 transition-transform duration-200" />
      </Button>
      {isOpen && (
        <FeedbackModal
          open={isOpen}
          onOpenChange={setIsOpen}
          currentUrl={typeof window !== 'undefined' ? window.location.href : undefined}
        />
      )}
    </>
  )
}

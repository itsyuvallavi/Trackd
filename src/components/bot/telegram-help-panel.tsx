'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TelegramHelpPanelProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  {
    title: 'Create a bot',
    body: (
      <>
        In Telegram, open a chat with{' '}
        <strong className="font-medium text-foreground">@BotFather</strong> and send{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/newbot</code>.
        Follow the prompts, then copy the bot token.
      </>
    ),
    note: (
      <>
        Add the token to your server as{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          TELEGRAM_BOT_TOKEN
        </code>
        .
      </>
    ),
  },
  {
    title: 'Start a conversation',
    body: (
      <>
        Open your new bot in Telegram and send{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/start</code>.
        This links your account so the bot can message you.
      </>
    ),
  },
  {
    title: 'Find your chat ID',
    body: (
      <>
        In your browser, open the Telegram API updates URL (replace{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">&lt;TOKEN&gt;</code>{' '}
        with your bot token):
      </>
    ),
    code: 'https://api.telegram.org/bot<TOKEN>/getUpdates',
    note: (
      <>
        In the JSON response, find{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          &quot;chat&quot;:&#123;&quot;id&quot;:123456789&#125;
        </code>
        . That number is your chat ID.
      </>
    ),
  },
  {
    title: 'Verify in Trackd',
    body: (
      <>
        Paste your chat ID into the field on the setup page and click{' '}
        <strong className="font-medium text-foreground">Verify</strong>. You should receive a
        test message in Telegram.
      </>
    ),
  },
] as const

export function TelegramHelpPanel({ open, onClose }: TelegramHelpPanelProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close help panel"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-help-title"
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl',
          'animate-in slide-in-from-right-full fade-in duration-200'
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notifications
            </p>
            <h2 id="telegram-help-title" className="mt-0.5 text-base font-semibold">
              Connect Telegram
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Trackd can send job alerts to Telegram. Set up a bot once on your server, then add your
            personal chat ID here.
          </p>

          <ol className="mt-6 space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {step.title}
                </p>
                <div className="space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                  <p>{step.body}</p>
                  {'code' in step && step.code ? (
                    <p className="break-all rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground">
                      {step.code}
                    </p>
                  ) : null}
                  {'note' in step && step.note ? <p>{step.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>,
    document.body
  )
}

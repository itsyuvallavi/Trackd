/**
 * Telegram notification client.
 * Uses the Telegram Bot API directly (no SDK needed).
 *
 * Setup:
 * 1. Message @BotFather on Telegram → /newbot → save the token as TELEGRAM_BOT_TOKEN
 * 2. User starts the bot, sends /start → we read their chat ID and save it to BotConfig
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  return token
}

async function sendTelegramRequest(
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const token = getToken()
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Telegram API error ${res.status}: ${text}`)
  }

  return res.json()
}

export async function sendMessage(
  chatId: string,
  text: string,
  options?: { parseMode?: 'HTML' | 'Markdown'; disablePreview?: boolean }
): Promise<void> {
  await sendTelegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode ?? 'HTML',
    disable_web_page_preview: options?.disablePreview ?? true,
  })
}

export interface BotRunSummary {
  jobsFound: number
  jobsNew: number
  jobsApproved: number
  /** Same URL as a job already stored for this user */
  skippedExistingByUrl: number
  /** Same company + title as a job already stored */
  skippedExistingByTitle: number
  /** Duplicate listing within this search response */
  skippedBatchDuplicate: number
  /** Matched a job you deleted earlier — not re-imported */
  skippedPreviouslyDismissed: number
  /** Evaluated but score below minScore — not written to the DB */
  skippedLowScore: number
  minScore: number
  topJobs: Array<{
    title: string
    company: string
    location?: string | null
    url?: string | null
    score?: number
  }>
  errors: Record<string, string>
}

export async function sendBotRunSummary(
  chatId: string,
  summary: BotRunSummary
): Promise<void> {
  const errorCount = Object.keys(summary.errors).length

  const dedupTotal =
    summary.skippedExistingByUrl +
    summary.skippedExistingByTitle +
    summary.skippedBatchDuplicate +
    summary.skippedPreviouslyDismissed

  let text = `<b>🤖 Job Search Complete</b>\n\n`
  text += `📊 <b>Stats:</b>\n`
  text += `• From APIs: ${summary.jobsFound} listings\n`
  if (dedupTotal > 0) {
    text += `• Already in Trackd: ${dedupTotal} skipped`
    const parts: string[] = []
    if (summary.skippedExistingByUrl > 0) parts.push(`${summary.skippedExistingByUrl} same link`)
    if (summary.skippedExistingByTitle > 0) parts.push(`${summary.skippedExistingByTitle} same role`)
    if (summary.skippedBatchDuplicate > 0) parts.push(`${summary.skippedBatchDuplicate} duplicate in batch`)
    if (summary.skippedPreviouslyDismissed > 0) {
      parts.push(`${summary.skippedPreviouslyDismissed} removed earlier`)
    }
    text += ` (${parts.join(', ')})\n`
  } else {
    text += `• Already in Trackd: 0 (no URL/title duplicates or removed listings)\n`
  }
  if (summary.skippedLowScore > 0) {
    text += `• Below AI threshold (${summary.minScore}/100): ${summary.skippedLowScore} not saved\n`
  }
  text += `• Saved to your list: ${summary.jobsNew}\n`
  text += `• Strong matches (≥${summary.minScore}): ${summary.jobsApproved}\n`

  if (summary.topJobs.length > 0) {
    text += `\n⭐ <b>Top Picks:</b>\n`
    for (const job of summary.topJobs.slice(0, 5)) {
      const scoreLabel = job.score ? ` (${job.score}/100)` : ''
      const locationLabel = job.location ? ` · ${job.location}` : ''
      if (job.url) {
        text += `• <a href="${job.url}">${job.title}</a> @ ${job.company}${locationLabel}${scoreLabel}\n`
      } else {
        text += `• ${job.title} @ ${job.company}${locationLabel}${scoreLabel}\n`
      }
    }
  }

  if (errorCount > 0) {
    text += `\n⚠️ ${errorCount} error(s) during search. Check the dashboard for details.\n`
  }

  text += `\n<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://trackd.app'}/jobs">View all jobs →</a>`

  await sendMessage(chatId, text)
}

/**
 * Verify a Telegram chat ID by sending a test message.
 * Returns true if the message was delivered.
 */
export async function verifyTelegramChatId(chatId: string): Promise<boolean> {
  try {
    await sendMessage(
      chatId,
      `✅ <b>Trackd connected!</b>\n\nYou'll receive job search updates here. You can disable notifications in Settings → Bot.`
    )
    return true
  } catch {
    return false
  }
}

/**
 * Get updates from Telegram to find new chat IDs.
 * Used during setup to detect when a user starts the bot.
 */
export async function getLatestUpdates(): Promise<
  Array<{ chatId: string; username?: string; firstName?: string }>
> {
  try {
    const token = getToken()
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getUpdates?limit=10`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      result: Array<{
        message?: {
          chat: { id: number; username?: string; first_name?: string }
          text?: string
        }
      }>
    }
    const updates = data.result || []
    return updates
      .filter((u) => u.message?.text?.startsWith('/start'))
      .map((u) => ({
        chatId: String(u.message!.chat.id),
        username: u.message!.chat.username,
        firstName: u.message!.chat.first_name,
      }))
  } catch {
    return []
  }
}

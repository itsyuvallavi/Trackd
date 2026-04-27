import type { EmailIntegration } from '@prisma/client'
import { EmailProvider } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { EmailMessage } from '@/lib/email-service'
import { createEmailService } from '@/lib/email-service'
import { alignEmailSyncLowerBound } from '@/lib/email-sync-window'

const TOKEN_SKEW_MS = 5 * 60 * 1000
/** Cap per sync to stay within serverless time limits */
const MAX_OAUTH_MESSAGES = 400

function decodeBase64Url(data: string): string {
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4))
  const b64 = (data + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64').toString('utf-8')
}

function htmlToPlainText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type GmailPart = {
  mimeType?: string
  body?: { data?: string; attachmentId?: string }
  parts?: GmailPart[]
}

function collectGmailBodies(part: GmailPart | undefined, out: { text: string; html: string }) {
  if (!part) return
  if (part.mimeType === 'text/plain' && part.body?.data) {
    out.text = decodeBase64Url(part.body.data)
  } else if (part.mimeType === 'text/html' && part.body?.data) {
    out.html = decodeBase64Url(part.body.data)
  }
  if (part.parts) {
    for (const p of part.parts) collectGmailBodies(p, out)
  }
}

function gmailAfterQuery(d: Date): string {
  return `after:${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

async function refreshGoogleAccessToken(integration: EmailIntegration): Promise<{
  accessToken: string
  expiresAt: Date | null
}> {
  const rt = integration.refreshToken
  if (!rt) {
    throw new Error(
      'Gmail connection expired. Disconnect and reconnect Google in Email settings (enable offline access).',
    )
  }
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured on the server')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rt,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.error('Google token refresh failed:', t)
    throw new Error('Failed to refresh Gmail access. Reconnect Google in settings.')
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number }
  const expiresAt =
    typeof json.expires_in === 'number'
      ? new Date(Date.now() + json.expires_in * 1000)
      : null
  await prisma.emailIntegration.update({
    where: { userId: integration.userId },
    data: {
      accessToken: json.access_token,
      tokenExpiry: expiresAt,
    },
  })
  return { accessToken: json.access_token, expiresAt }
}

async function getGoogleAccessToken(integration: EmailIntegration): Promise<string> {
  const now = Date.now()
  const exp = integration.tokenExpiry?.getTime() ?? 0
  if (integration.accessToken && exp > now + TOKEN_SKEW_MS) {
    return integration.accessToken
  }
  const { accessToken } = await refreshGoogleAccessToken(integration)
  return accessToken
}

async function gmailAuthorizedFetch(url: string, integration: EmailIntegration): Promise<Response> {
  let token = await getGoogleAccessToken(integration)
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    const latest = await prisma.emailIntegration.findUniqueOrThrow({
      where: { userId: integration.userId },
    })
    await refreshGoogleAccessToken(latest)
    const after = await prisma.emailIntegration.findUniqueOrThrow({
      where: { userId: integration.userId },
    })
    token = after.accessToken!
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  }
  return res
}

async function fetchViaGmail(integration: EmailIntegration, syncSince: Date): Promise<EmailMessage[]> {
  const q = gmailAfterQuery(syncSince)
  const collected: EmailMessage[] = []
  let pageToken: string | undefined

  while (collected.length < MAX_OAUTH_MESSAGES) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    url.searchParams.set('q', q)
    url.searchParams.set('maxResults', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const listRes = await gmailAuthorizedFetch(url.toString(), integration)
    if (!listRes.ok) {
      const errText = await listRes.text()
      console.error('Gmail list messages failed:', listRes.status, errText)
      throw new Error(`Gmail API error (${listRes.status})`)
    }
    const listJson = (await listRes.json()) as {
      messages?: { id: string }[]
      nextPageToken?: string
    }
    const ids = listJson.messages?.map((m) => m.id) ?? []
    if (ids.length === 0) break

    for (const id of ids) {
      if (collected.length >= MAX_OAUTH_MESSAGES) break
      const msgRes = await gmailAuthorizedFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        integration,
      )
      if (!msgRes.ok) {
        console.error(`Gmail get message ${id} failed:`, await msgRes.text())
        continue
      }
      const msg = (await msgRes.json()) as {
        id: string
        internalDate?: string
        payload?: {
          mimeType?: string
          headers?: { name: string; value: string }[]
          parts?: GmailPart[]
          body?: { data?: string }
        }
      }
      const headers = msg.payload?.headers ?? []
      const h = Object.fromEntries(headers.map((x) => [x.name.toLowerCase(), x.value]))

      const bodies = { text: '', html: '' }
      if (msg.payload?.parts?.length) {
        collectGmailBodies({ parts: msg.payload.parts }, bodies)
      } else if (msg.payload?.body?.data) {
        if (msg.payload?.mimeType === 'text/html') {
          bodies.html = decodeBase64Url(msg.payload.body.data)
        } else {
          bodies.text = decodeBase64Url(msg.payload.body.data)
        }
      }

      const internalMs = msg.internalDate ? parseInt(msg.internalDate, 10) : NaN
      const date = !Number.isNaN(internalMs)
        ? new Date(internalMs)
        : h.date
          ? new Date(h.date)
          : new Date()

      if (date < alignEmailSyncLowerBound(syncSince)) continue

      const from = h.from ?? ''
      const to = h.to ?? ''
      const subject = h.subject ?? ''
      const rfcId = h['message-id']?.trim()
      collected.push({
        id: rfcId && rfcId.length > 0 ? rfcId : `gmail:${msg.id}`,
        from,
        to,
        subject,
        date,
        textBody: bodies.text || htmlToPlainText(bodies.html),
        htmlBody: bodies.html,
      })
    }

    pageToken = listJson.nextPageToken
    if (!pageToken) break
  }

  return collected
}

async function refreshMicrosoftAccessToken(integration: EmailIntegration): Promise<{
  accessToken: string
  expiresAt: Date | null
}> {
  const rt = integration.refreshToken
  if (!rt) {
    throw new Error('Outlook connection expired. Disconnect and reconnect Microsoft in Email settings.')
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth is not configured on the server')
  }
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rt,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.error('Microsoft token refresh failed:', t)
    throw new Error('Failed to refresh Outlook access. Reconnect Microsoft in settings.')
  }
  const json = (await res.json()) as {
    access_token: string
    expires_in?: number
    refresh_token?: string
  }
  const expiresAt =
    typeof json.expires_in === 'number'
      ? new Date(Date.now() + json.expires_in * 1000)
      : null
  await prisma.emailIntegration.update({
    where: { userId: integration.userId },
    data: {
      accessToken: json.access_token,
      tokenExpiry: expiresAt,
      ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
    },
  })
  return { accessToken: json.access_token, expiresAt }
}

async function getMicrosoftAccessToken(integration: EmailIntegration): Promise<string> {
  const now = Date.now()
  const exp = integration.tokenExpiry?.getTime() ?? 0
  if (integration.accessToken && exp > now + TOKEN_SKEW_MS) {
    return integration.accessToken
  }
  const { accessToken } = await refreshMicrosoftAccessToken(integration)
  return accessToken
}

async function fetchViaMicrosoft(integration: EmailIntegration, syncSince: Date): Promise<EmailMessage[]> {
  const fresh = await prisma.emailIntegration.findUniqueOrThrow({
    where: { userId: integration.userId },
  })
  let accessToken = await getMicrosoftAccessToken(fresh)
  const sinceIso = syncSince.toISOString()
  const collected: EmailMessage[] = []
  const filterQs = new URLSearchParams({
    $filter: `receivedDateTime ge ${sinceIso}`,
    $orderby: 'receivedDateTime asc',
    $top: '50',
    $select: 'id,subject,from,toRecipients,receivedDateTime,internetMessageId,body',
  })
  let nextUrl: string | null = `https://graph.microsoft.com/v1.0/me/messages?${filterQs.toString()}`

  while (nextUrl && collected.length < MAX_OAUTH_MESSAGES) {
    let res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 401) {
      accessToken = (
        await refreshMicrosoftAccessToken(
          await prisma.emailIntegration.findUniqueOrThrow({ where: { userId: integration.userId } }),
        )
      ).accessToken
      res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    }
    if (!res.ok) {
      const errText = await res.text()
      console.error('Microsoft Graph messages failed:', res.status, errText)
      throw new Error(`Microsoft Graph error (${res.status})`)
    }
    const page = (await res.json()) as {
      value?: Array<{
        id: string
        subject?: string
        from?: { emailAddress?: { address?: string } }
        toRecipients?: Array<{ emailAddress?: { address?: string } }>
        receivedDateTime: string
        internetMessageId?: string
        body?: { contentType?: string; content?: string }
      }>
      '@odata.nextLink'?: string
    }
    const rows = page.value ?? []
    for (const msg of rows) {
      if (collected.length >= MAX_OAUTH_MESSAGES) break
      const date = new Date(msg.receivedDateTime)
      if (date < alignEmailSyncLowerBound(syncSince)) continue
      const html =
        msg.body?.contentType?.toLowerCase() === 'html' ? (msg.body.content ?? '') : ''
      const textDirect =
        msg.body?.contentType?.toLowerCase() === 'text' ? (msg.body.content ?? '') : ''
      collected.push({
        id: msg.internetMessageId?.trim() || `m365:${msg.id}`,
        from: msg.from?.emailAddress?.address ?? '',
        to: msg.toRecipients?.[0]?.emailAddress?.address ?? '',
        subject: msg.subject ?? '',
        date,
        textBody: textDirect || htmlToPlainText(html),
        htmlBody: html,
      })
    }
    nextUrl = page['@odata.nextLink'] ?? null
  }

  return collected
}

function fetchViaImap(integration: EmailIntegration, syncSince: Date): Promise<EmailMessage[]> {
  if (
    !integration.imapHost ||
    !integration.imapPort ||
    !integration.imapUsername ||
    !integration.imapPassword
  ) {
    return Promise.reject(new Error('Missing IMAP configuration'))
  }
  const emailService = createEmailService({
    host: integration.imapHost,
    port: integration.imapPort,
    user: integration.imapUsername,
    password: integration.imapPassword,
  })
  return emailService.fetchEmailsSince(syncSince)
}

/** Lightweight check that stored OAuth tokens can read mail. */
export async function verifyGmailConnection(integration: EmailIntegration): Promise<void> {
  const latest = await prisma.emailIntegration.findUniqueOrThrow({
    where: { userId: integration.userId },
  })
  const token = await getGoogleAccessToken(latest)
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const t = await res.text()
    console.error('Gmail profile check failed:', res.status, t)
    throw new Error('Cannot reach Gmail with the saved connection. Reconnect Google.')
  }
}

export async function verifyMicrosoftConnection(integration: EmailIntegration): Promise<void> {
  const latest = await prisma.emailIntegration.findUniqueOrThrow({
    where: { userId: integration.userId },
  })
  let token = await getMicrosoftAccessToken(latest)
  let res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    token = (
      await refreshMicrosoftAccessToken(
        await prisma.emailIntegration.findUniqueOrThrow({ where: { userId: integration.userId } }),
      )
    ).accessToken
    res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
  if (!res.ok) {
    const t = await res.text()
    console.error('Microsoft Graph me check failed:', res.status, t)
    throw new Error('Cannot reach Outlook with the saved connection. Reconnect Microsoft.')
  }
}

/**
 * Fetches email messages for sync using IMAP or provider OAuth APIs (Gmail / Microsoft Graph).
 */
export async function fetchEmailsSinceForIntegration(
  integration: EmailIntegration,
  syncSince: Date,
): Promise<EmailMessage[]> {
  switch (integration.provider) {
    case EmailProvider.IMAP:
      return fetchViaImap(integration, syncSince)
    case EmailProvider.GMAIL_OAUTH:
      return fetchViaGmail(integration, syncSince)
    case EmailProvider.MICROSOFT_OAUTH:
      return fetchViaMicrosoft(integration, syncSince)
    default:
      throw new Error(`Unsupported email provider: ${integration.provider}`)
  }
}

import { Resend } from 'resend'
import { FeedbackType, FeedbackSource } from '@prisma/client'

// For Resend testing: can only send to account owner's email
// For production: verify domain at resend.com/domains to send to any email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yuvalavi12@gmail.com'

// Initialize Resend only if API key is available
const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }
  return new Resend(apiKey)
}

export interface FeedbackEmailData {
  type: FeedbackType
  title: string
  description: string
  userEmail?: string | null
  userName?: string | null
  url?: string | null
  userAgent?: string | null
  source: FeedbackSource
}

export async function sendFeedbackEmail(data: FeedbackEmailData): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY not set in environment variables. Email notification skipped.')
    console.warn('   To enable emails, add RESEND_API_KEY to your .env file')
    console.warn('   Current ADMIN_EMAIL:', ADMIN_EMAIL)
    console.warn('   RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY)
    return
  }

  console.log(`📧 Attempting to send feedback email to ${ADMIN_EMAIL}...`)
  console.log('   RESEND_API_KEY is set:', !!process.env.RESEND_API_KEY)

  const typeLabels: Record<FeedbackType, string> = {
    ERROR: 'Error',
    BUG: 'Bug Report',
    FEATURE_REQUEST: 'Feature Request',
    OTHER: 'Other',
  }

  const sourceLabels: Record<FeedbackSource, string> = {
    WEB: 'Web App',
    EXTENSION: 'Browser Extension',
  }

  try {
    // For testing: use Resend's default domain and send to account owner's email
    // For production: verify your domain and use your own domain in 'from' address
    const emailData: any = {
      from: 'Trackd <onboarding@resend.dev>', // Resend's default testing domain
      to: ADMIN_EMAIL, // Must be account owner's email in testing mode
      subject: `[Feedback] ${typeLabels[data.type]}: ${data.title}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; margin-bottom: 16px;">New Feedback Submission</h2>
          
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0;"><strong>Type:</strong> ${typeLabels[data.type]}</p>
            <p style="margin: 0 0 8px 0;"><strong>Source:</strong> ${sourceLabels[data.source]}</p>
            <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${data.title}</p>
            ${data.userEmail ? `<p style="margin: 0 0 8px 0;"><strong>User:</strong> ${data.userName || data.userEmail} (${data.userEmail})</p>` : ''}
            ${data.url ? `<p style="margin: 0 0 8px 0;"><strong>URL:</strong> <a href="${data.url}">${data.url}</a></p>` : ''}
          </div>
          
          <div style="background: #ffffff; padding: 16px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="margin-top: 0; color: #1a1a1a;">Description</h3>
            <p style="white-space: pre-wrap; color: #333;">${data.description}</p>
          </div>
          
          ${data.userAgent ? `
          <div style="font-size: 12px; color: #666; margin-top: 16px;">
            <strong>User Agent:</strong> ${data.userAgent}
          </div>
          ` : ''}
          
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
            <p style="margin: 0;">This is an automated notification from Trackd.</p>
          </div>
        </div>
      `,
      text: `
New Feedback Submission

Type: ${typeLabels[data.type]}
Source: ${sourceLabels[data.source]}
Title: ${data.title}
${data.userEmail ? `User: ${data.userName || data.userEmail} (${data.userEmail})\n` : ''}
${data.url ? `URL: ${data.url}\n` : ''}

Description:
${data.description}

${data.userAgent ? `User Agent: ${data.userAgent}\n` : ''}
---
This is an automated notification from Trackd.
      `.trim(),
    }

    const result = await resend.emails.send(emailData)

    if (result.error) {
      console.error('❌ Resend API error:', result.error)
      throw new Error(`Resend error: ${JSON.stringify(result.error)}`)
    }

    console.log('✅ Feedback email sent successfully!', {
      id: result.data?.id,
      to: ADMIN_EMAIL,
    })
  } catch (error) {
    console.error('❌ Failed to send feedback email:', error)
    if (error instanceof Error) {
      console.error('   Error message:', error.message)
      console.error('   Error stack:', error.stack)
    }
    // Don't throw - email failure shouldn't break feedback submission
    // But log it so we can debug
  }
}


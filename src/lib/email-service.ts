import Imap from 'imap'
import { simpleParser, ParsedMail } from 'mailparser'

export interface EmailMessage {
  id: string
  from: string
  to: string
  subject: string
  date: Date
  textBody: string
  htmlBody: string
}

interface ImapConfig {
  host: string
  port: number
  user: string
  password: string
}

export class EmailService {
  private config: ImapConfig

  constructor(config: ImapConfig) {
    this.config = config
  }

  /**
   * Create a fresh IMAP connection
   */
  private createConnection(): Imap {
    return new Imap({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })
  }

  /**
   * Fetch emails from inbox since a given date
   */
  async fetchEmailsSince(since: Date): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      const messages: EmailMessage[] = []
      const imap = this.createConnection()

      imap.once('ready', () => {
        console.log('IMAP ready, listing boxes...')

        // First, let's see what boxes are available
        imap.getBoxes((err: any, boxes: any) => {
          if (err) {
            console.error('Error getting boxes:', err)
          } else {
            console.log('Available mailboxes:', Object.keys(boxes))
          }
        })

        console.log('Opening INBOX...')
        imap.openBox('INBOX', true, (err: any, box: any) => {
          if (err) {
            console.error('Error opening INBOX:', err)
            reject(err)
            return
          }

          console.log(`✓ INBOX opened. Total messages: ${box.messages.total}`)

          // Search for emails since the given date
          // IMAP SINCE uses format: 'DD-MMM-YYYY' (e.g., '01-Jan-2024')
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const sinceDate = `${since.getDate()}-${months[since.getMonth()]}-${since.getFullYear()}`
          console.log(`Searching for emails since: ${sinceDate}`)

          // Use UNSEEN or ALL to get recent emails if SINCE doesn't work well
          const searchCriteria = [['SINCE', sinceDate]]

          imap.search(searchCriteria, (err: any, results: any) => {
            if (err) {
              console.error('Search error:', err)
              reject(err)
              return
            }

            console.log(`Search returned ${results ? results.length : 0} results`)

            if (!results || results.length === 0) {
              console.log('No emails found matching criteria')
              imap.end()
              resolve([])
              return
            }

            console.log(`Fetching ${results.length} emails...`)

            const fetch = imap.fetch(results, { bodies: '' })
            let pendingMessages = results.length

            fetch.on('message', (msg: any) => {
              msg.on('body', (stream: any) => {
                simpleParser(stream, (err: any, parsed: any) => {
                  if (err) {
                    console.error('Error parsing email:', err)
                    pendingMessages--
                    return
                  }

                  messages.push(this.parsedMailToEmailMessage(parsed))
                  pendingMessages--

                  // Check if all messages are processed
                  if (pendingMessages === 0) {
                    console.log(`Successfully parsed ${messages.length} emails`)
                  }
                })
              })
            })

            fetch.once('error', (err: any) => {
              console.error('Fetch error:', err)
              reject(err)
            })

            fetch.once('end', () => {
              console.log('Fetch complete, closing connection...')
              // Wait a bit for async parsing to complete
              setTimeout(() => {
                imap.end()
              }, 1000)
            })
          })
        })
      })

      imap.once('error', (err: any) => {
        console.error('IMAP error:', err)
        reject(err)
      })

      imap.once('end', () => {
        console.log('IMAP connection closed')
        resolve(messages)
      })

      imap.connect()
    })
  }

  /**
   * Convert parsed mail to our EmailMessage format
   */
  private parsedMailToEmailMessage(parsed: ParsedMail): EmailMessage {
    // Handle from field - AddressObject has .text and .value array
    let from = ''
    if (parsed.from) {
      const fromObj = Array.isArray(parsed.from) ? parsed.from[0] : parsed.from
      from = fromObj?.value?.[0]?.address || fromObj?.text || ''
    }

    // Handle to field - can be AddressObject or AddressObject[]
    let to = ''
    if (parsed.to) {
      const toObj = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to
      to = toObj?.value?.[0]?.address || toObj?.text || ''
    }

    return {
      id: parsed.messageId || `${Date.now()}-${Math.random()}`,
      from,
      to,
      subject: parsed.subject || '',
      date: parsed.date || new Date(),
      textBody: parsed.text || '',
      htmlBody: parsed.html || '',
    }
  }

  /**
   * Test connection to email server
   */
  async testConnection(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection()

      imap.once('ready', () => {
        console.log('Test connection successful')
        imap.end()
        resolve(true)
      })

      imap.once('error', (err: any) => {
        console.error('Test connection error:', err)
        reject(err)
      })

      imap.connect()
    })
  }
}

/**
 * Create email service from environment variables
 */
export function createEmailService(): EmailService {
  const config = {
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT!),
    user: process.env.IMAP_USERNAME!,
    password: process.env.IMAP_PASSWORD!,
  }

  return new EmailService(config)
}

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

export interface ImapConfig {
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
      let isResolved = false

      const safeResolve = (data: EmailMessage[]) => {
        if (!isResolved) {
          isResolved = true
          console.log('Resolving promise with', data.length, 'messages')
          resolve(data)
        }
      }

      const safeReject = (err: any) => {
        if (!isResolved) {
          isResolved = true
          console.error('Rejecting promise with error:', err)
          reject(err)
        }
      }

      // Safety timeout - resolve after 60 seconds max to prevent hanging
      const safetyTimeout = setTimeout(() => {
        if (!isResolved) {
          console.log('Safety timeout reached, resolving with', messages.length, 'messages so far')
          safeResolve(messages)
        }
      }, 60000)

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
            clearTimeout(safetyTimeout)
            safeReject(err)
            return
          }

          console.log(`✓ INBOX opened. Total messages: ${box.messages.total}`)

          // Search for emails since the given date
          // IMAP SINCE uses format: 'DD-MMM-YYYY' (e.g., '01-Jan-2024')
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const day = since.getDate().toString().padStart(2, '0')
          const sinceDate = `${day}-${months[since.getMonth()]}-${since.getFullYear()}`
          console.log(`Searching for emails since: ${sinceDate}`)
          const searchCriteria = [['SINCE', sinceDate]]

          imap.search(searchCriteria, (err: any, results: any) => {
            if (err) {
              console.error('Search error:', err)
              clearTimeout(safetyTimeout)
              safeReject(err)
              return
            }

            console.log(`Search returned ${results ? results.length : 0} results`)

            if (!results || results.length === 0) {
              console.log('No emails found matching criteria')
              clearTimeout(safetyTimeout)
              imap.end()
              safeResolve([])
              return
            }

            console.log(`Fetching ${results.length} emails...`)

            const fetch = imap.fetch(results, { bodies: '' })
            let pendingMessages = results.length
            let fetchEnded = false

            const tryResolve = () => {
              if (fetchEnded && pendingMessages === 0 && !isResolved) {
                console.log('All emails parsed and fetch ended, resolving immediately...')
                clearTimeout(safetyTimeout)
                // Close connection asynchronously (fire and forget)
                try {
                  imap.end()
                } catch (e) {
                  // Ignore errors when closing
                }
                // Resolve immediately - we have all the data we need
                safeResolve(messages)
              }
            }

            fetch.on('message', (msg: any) => {
              msg.on('body', (stream: any) => {
                simpleParser(stream, (err: any, parsed: any) => {
                  if (err) {
                    console.error('Error parsing email:', err)
                    pendingMessages--
                    tryResolve()
                    return
                  }

                  const emailMessage = this.parsedMailToEmailMessage(parsed)
                  // Filter by exact timestamp since IMAP SINCE only supports date, not time
                  // Only include emails that are actually after the syncSince timestamp
                  if (emailMessage.date >= since) {
                    messages.push(emailMessage)
                  } else {
                    console.log(`Filtered out email "${emailMessage.subject}" - date ${emailMessage.date.toISOString()} is before syncSince ${since.toISOString()}`)
                  }
                  pendingMessages--

                  // Check if all messages are processed
                  if (pendingMessages === 0) {
                    console.log(`Successfully parsed ${messages.length} emails (after filtering by timestamp)`)
                    tryResolve()
                  }
                })
              })
            })

            fetch.once('error', (err: any) => {
              console.error('Fetch error:', err)
              clearTimeout(safetyTimeout)
              safeReject(err)
            })

            fetch.once('end', () => {
              console.log('Fetch stream ended, waiting for all parsing to complete...')
              fetchEnded = true
              
              if (pendingMessages === 0) {
                console.log('All emails already parsed, resolving immediately...')
                clearTimeout(safetyTimeout)
                try {
                  imap.end()
                } catch (e) {
                  // Ignore errors when closing
                }
                safeResolve(messages)
              } else {
                // Wait for all async parsing to complete
                const checkComplete = setInterval(() => {
                  if (pendingMessages === 0) {
                    clearInterval(checkComplete)
                    console.log('All emails parsed, resolving immediately...')
                    clearTimeout(safetyTimeout)
                    try {
                      imap.end()
                    } catch (e) {
                      // Ignore errors when closing
                    }
                    safeResolve(messages)
                  }
                }, 100)
              }
            })
          })
        })
      })

      imap.once('error', (err: any) => {
        console.error('IMAP error:', err)
        clearTimeout(safetyTimeout)
        safeReject(err)
      })

      imap.once('end', () => {
        console.log('IMAP connection closed event fired, resolving promise with', messages.length, 'messages')
        clearTimeout(safetyTimeout)
        safeResolve(messages)
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
 * Create an email service from explicit configuration.
 * Callers (like email actions) are responsible for passing the
 * per-user IMAP settings from the database or form.
 */
export function createEmailService(config: ImapConfig): EmailService {
  return new EmailService(config)
}

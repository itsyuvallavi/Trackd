import { NextRequest, NextResponse } from 'next/server'

/**
 * Wraps an API route handler with a timeout
 * Returns 504 Gateway Timeout if the handler exceeds the timeout
 * 
 * @param handler - The route handler function
 * @param timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 */
export function withTimeout<T extends NextRequest>(
  handler: (request: T, context?: any) => Promise<NextResponse>,
  timeoutMs: number = 30000
) {
  return async (request: T, context?: any): Promise<NextResponse> => {
    return Promise.race([
      handler(request, context),
      new Promise<NextResponse>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(`Request exceeded timeout of ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ]).catch((error) => {
      if (error instanceof TimeoutError) {
        console.error('Request timeout:', error.message)
        return NextResponse.json(
          { 
            error: 'Request timeout',
            message: 'The request took too long to process. Please try again.',
          },
          { status: 504 }
        )
      }
      // Re-throw other errors to be handled by the route handler
      throw error
    })
  }
}

/**
 * Custom error class for timeouts
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}


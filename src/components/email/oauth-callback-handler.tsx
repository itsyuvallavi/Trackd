'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Handles OAuth callback success/error messages and refreshes the page
 */
export function OAuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasHandled, setHasHandled] = useState(false)

  useEffect(() => {
    if (hasHandled) return
    
    const successParam = searchParams?.get('success')
    const errorParam = searchParams?.get('error')

    if (successParam || errorParam) {
      setSuccess(successParam)
      setError(errorParam)
      setHasHandled(true)
      
      // Clear URL parameters
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
      
      // Refresh the page data after a short delay to show message and reload integration status
      setTimeout(() => {
        router.refresh()
      }, 1500) // Give user time to see the success message
    }
  }, [searchParams, router, hasHandled])

  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✅ {success === 'google_connected' ? 'Google email successfully connected!' : success === 'microsoft_connected' ? 'Microsoft email successfully connected!' : 'Email successfully connected!'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-red-800 dark:text-red-200">
            ❌ Error: {error}
          </p>
        </div>
      </div>
    )
  }

  return null
}


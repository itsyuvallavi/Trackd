'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

// Default fetcher for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  return res.json()
}

interface SWRProviderProps {
  children: ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Stale-while-revalidate: show cached data immediately, revalidate in background
        revalidateOnFocus: false, // Don't refetch when window regains focus (reduces server load)
        revalidateOnReconnect: true, // Refetch when internet reconnects
        dedupingInterval: 5000, // Dedupe requests within 5 seconds
        errorRetryCount: 3, // Retry failed requests up to 3 times
        keepPreviousData: true, // Keep showing previous data while loading new data
      }}
    >
      {children}
    </SWRConfig>
  )
}


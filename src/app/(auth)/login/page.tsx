import { redirect } from 'next/navigation'
import { safeAuthRedirectPath } from '@/lib/auth-callback'

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}
  const next = safeAuthRedirectPath(params.next)
  const error = params.error

  const url = new URLSearchParams({ next })
  if (error) {
    url.set('error', error)
  }

  redirect(`/?${url.toString()}`)
}


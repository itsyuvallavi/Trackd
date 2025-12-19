import { redirect } from 'next/navigation'

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}
  const next = params.next ?? '/jobs'

  redirect(`/?next=${encodeURIComponent(next)}`)
}




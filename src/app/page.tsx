import { redirect } from 'next/navigation'
import { CheckSquare } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getCurrentUser } from '@/lib/auth'
import { HeroImage } from '@/components/home/hero-image'

interface HomePageProps {
  searchParams?: Promise<{ next?: string }>
}

export default async function Home({ searchParams }: HomePageProps) {
  // Check if user is already authenticated
  const user = await getCurrentUser()
  
  // If authenticated, redirect to /jobs
  if (user) {
    redirect('/jobs')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const next = resolvedSearchParams.next ?? '/jobs'

  return (
    <div className="min-h-screen w-full flex dark">
      {/* Left Side - Auth */}
      <div className="w-full lg:w-1/2 bg-background text-foreground flex flex-col justify-center p-8 lg:p-12 xl:p-16">
        <div className="max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <CheckSquare className="size-8" strokeWidth={2.5} />
            <span className="text-xl">Trackd</span>
          </div>

          {/* Welcome + Auth */}
          <div>
            <h1 className="mb-3 text-2xl font-semibold">Welcome</h1>
            <p className="text-muted-foreground mb-6">
              Sign in or create your account to start tracking your job applications.
            </p>

            <LoginForm next={next} />
          </div>
        </div>
      </div>

      {/* Right Side - Image */}
      <HeroImage />
    </div>
  )
}
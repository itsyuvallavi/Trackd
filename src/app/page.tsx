import { redirect } from 'next/navigation'
import { CheckSquare } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getCurrentUser } from '@/lib/auth'
import Image from 'next/image'

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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1686984096026-23d6e82f9749?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqb2IlMjBzZWFyY2glMjB3b3Jrc3BhY2UlMjBkZXNrfGVufDF8fHx8MTc2NTg1MDEzN3ww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Workspace"
          className="object-cover object-bottom"
          fill
          priority
          sizes="50vw"
          quality={85}
        />
      </div>
    </div>
  )
}
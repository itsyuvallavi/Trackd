# Authentication Implementation Plan

## Current Problem

Everyone currently accesses the same account via `TEMP_USER_ID`. We need proper authentication so:
- Users can create their own accounts
- Users can only see their own jobs
- The extension connects to the correct user's account

---

## Current Setup (What We Have)

### Supabase Project
- **URL**: `https://myxbtnqaruddbwmxoijs.supabase.co`
- **Anon Key**: Already in `.env` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Database**: Connected via `DATABASE_URL`
- **Package**: `@supabase/supabase-js` installed

### OAuth Credentials (for Email Sync - separate from Auth)
```
GOOGLE_CLIENT_ID=442976926416-t4a4rfgmkir3qpph1c8ncmnrn68m3v84.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
MICROSOFT_CLIENT_ID=4d6b5025-8c4d-4560-957d-52c666cf81ec
MICROSOFT_CLIENT_SECRET=c421fd49-2503-4bd2-8b69-d2be81912ebd
```

### Important Distinction
- **Email Sync OAuth** (existing): Reads Gmail/Outlook for job status updates
- **User Auth OAuth** (needed): Signs user into Trackd account

These are SEPARATE. A user can sign in with Google (auth) but connect their work Outlook for email sync.

---

## Technology Choice: Supabase Auth

**Why Supabase Auth:**
- Already using Supabase for database (Postgres)
- Built-in OAuth providers (Google, GitHub, etc.)
- Email/password support
- Session management handled automatically
- Easy Next.js integration with `@supabase/ssr`
- Free tier is generous
- Can reuse existing Google/Microsoft credentials (with updated redirect URIs)

---

## User Journey

### Sign Up
```
1. User visits trackd.app
2. Clicks "Get Started" or "Sign Up"
3. Options:
   a) Sign up with Google (recommended, one-click)
   b) Sign up with email/password
4. Redirected to /jobs (or /onboarding for first-time)
```

### Sign In
```
1. User visits trackd.app
2. Clicks "Sign In"
3. Options:
   a) Sign in with Google
   b) Sign in with email/password
4. Redirected to /jobs
```

### Protected Routes
```
All routes under /(authenticated)/* require login:
- /jobs
- /board
- /today
- /settings/*
- /jobs/[id]

If not logged in → redirect to /login
```

---

## Implementation Steps

### Phase 1: Supabase Setup

#### 1.1 Install Dependencies

```bash
bun add @supabase/supabase-js @supabase/ssr
```

#### 1.2 Environment Variables

Update `.env` (you already have most of these):

```env
# Supabase (update variable names for consistency)
NEXT_PUBLIC_SUPABASE_URL=https://myxbtnqaruddbwmxoijs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eGJ0bnFhcnVkZGJ3bXhvaWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDA1ODEsImV4cCI6MjA4MTQxNjU4MX0.ATzcfAdA8pi4CvXp8nvqlxkeUor3ksLYK3xCN6UnxSc

# Get this from Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** The service role key is only needed for admin operations. Get it from your Supabase project settings.

#### 1.3 Supabase Client Setup

Create utility files for Supabase client:

```typescript
// src/lib/supabase/client.ts
// Browser client for client components

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
// Server client for server components and API routes

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/middleware.ts
// For middleware session refresh

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
```

---

### Phase 2: Database Schema Updates

#### 2.1 Create Users Table (if not using Supabase auth.users directly)

We'll use Supabase's built-in `auth.users` table and create a `profiles` table for additional user data:

```prisma
// Add to prisma/schema.prisma

model Profile {
  id        String   @id // Same as Supabase auth.users.id
  email     String   @unique
  name      String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  jobs          Job[]
  activities    Activity[]
  extensionKey  ExtensionKey?
  emailIntegration EmailIntegration?
}
```

#### 2.2 Update Existing Models

Replace `userId String` with proper relation:

```prisma
model Job {
  id        String   @id @default(cuid())
  userId    String
  // ... other fields ...

  user      Profile  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Activity {
  id        String   @id @default(cuid())
  userId    String
  // ... other fields ...

  user      Profile  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

#### 2.3 Sync Supabase Auth → Profile

Create a database trigger or use Supabase webhook to create Profile when user signs up:

```sql
-- In Supabase SQL Editor
-- Auto-create profile on signup

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public."Profile" (id, email, name, "avatarUrl", "createdAt", "updatedAt")
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

### Phase 3: Auth UI Components

#### 3.1 Login Page

```typescript
// src/app/(auth)/login/page.tsx

import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to your Trackd account
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

#### 3.2 Login Form Component

```typescript
// src/components/auth/login-form.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chrome } from 'lucide-react' // Google icon placeholder

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleGoogleSignIn() {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      router.push('/jobs')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Google Sign In */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <Chrome className="size-4 mr-2" />
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email Sign In */}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <a href="/signup" className="text-primary hover:underline">
          Sign up
        </a>
      </p>
    </div>
  )
}
```

#### 3.3 Sign Up Page

```typescript
// src/app/(auth)/signup/page.tsx

import { SignUpForm } from '@/components/auth/signup-form'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground mt-2">
            Start tracking your job applications
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
```

#### 3.4 Sign Up Form Component

```typescript
// src/components/auth/signup-form.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chrome } from 'lucide-react'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleGoogleSignUp() {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="text-center p-6 border border-border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Check your email</h3>
        <p className="text-muted-foreground">
          We've sent you a confirmation link at <strong>{email}</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Google Sign Up */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
      >
        <Chrome className="size-4 mr-2" />
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email Sign Up */}
      <form onSubmit={handleEmailSignUp} className="space-y-4">
        <div>
          <Input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className="text-primary hover:underline">
          Sign in
        </a>
      </p>
    </div>
  )
}
```

#### 3.5 Auth Callback Route

```typescript
// src/app/auth/callback/route.ts

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/jobs'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

---

### Phase 4: Middleware for Protected Routes

```typescript
// src/middleware.ts

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that require authentication
const protectedRoutes = [
  '/jobs',
  '/board',
  '/today',
  '/settings',
]

// Routes that should redirect to /jobs if already logged in
const authRoutes = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const path = request.nextUrl.pathname

  // Check if accessing protected route without auth
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect logged-in users away from auth pages
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/jobs', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

### Phase 5: Update Data Fetching

#### 5.1 Helper to Get Current User

```typescript
// src/lib/auth.ts

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return user
}
```

#### 5.2 Update Jobs Page

```typescript
// src/app/(authenticated)/jobs/page.tsx

import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'

export default async function JobsPage() {
  const user = await requireAuth()

  const jobs = await prisma.job.findMany({
    where: { userId: user.id }, // Use actual user ID
    orderBy: { createdAt: 'desc' },
  })

  return <JobsPageContent jobs={jobs} />
}
```

#### 5.3 Update All Server Actions

```typescript
// src/app/(authenticated)/jobs/actions.ts

'use server'

import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createJob(data: CreateJobData) {
  const user = await requireAuth()

  const job = await prisma.job.create({
    data: {
      ...data,
      userId: user.id, // Use actual user ID
    },
  })

  revalidatePath('/jobs')
  return job
}

export async function updateJob(jobId: string, data: UpdateJobData) {
  const user = await requireAuth()

  // Verify ownership
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
  })

  if (!job) {
    throw new Error('Job not found')
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data,
  })

  revalidatePath('/jobs')
  return updated
}

export async function deleteJob(jobId: string) {
  const user = await requireAuth()

  // Verify ownership before delete
  await prisma.job.deleteMany({
    where: { id: jobId, userId: user.id },
  })

  revalidatePath('/jobs')
}
```

---

### Phase 6: Update User Profile Menu

```typescript
// src/components/layout/user-profile-menu.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UserProfileMenu() {
  const [user, setUser] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || user?.email?.[0].toUpperCase() || '?'

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="size-9 rounded-full p-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        {user?.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="Profile"
            className="size-9 rounded-full"
          />
        ) : (
          <div className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-xl z-20 py-1">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>

            <a
              href="/settings/integrations"
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
            >
              <Settings className="size-4" />
              Settings
            </a>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent w-full text-left text-red-500"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

---

### Phase 7: Landing Page (Public)

```typescript
// src/app/page.tsx

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If logged in, redirect to jobs
  if (user) {
    redirect('/jobs')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Track job applications
          <br />
          <span className="text-muted-foreground">without the spreadsheet</span>
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Save jobs with one click. Let email sync keep your statuses up to date.
          Never manually update a spreadsheet again.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">Sign In</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
```

---

## Implementation Checklist

### Phase 1: Setup
- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Add environment variables
- [ ] Create Supabase client utilities (client.ts, server.ts, middleware.ts)
- [ ] Enable Google OAuth in Supabase dashboard

### Phase 2: Database
- [ ] Add `Profile` model to Prisma schema
- [ ] Update `Job` and `Activity` models with proper relations
- [ ] Run migration
- [ ] Create database trigger for auto-profile creation
- [ ] Test profile creation on signup

### Phase 3: Auth UI
- [ ] Create `/login` page with LoginForm
- [ ] Create `/signup` page with SignUpForm
- [ ] Create `/auth/callback` route for OAuth
- [ ] Style auth pages to match app design

### Phase 4: Middleware
- [ ] Create middleware for route protection
- [ ] Test protected route redirects
- [ ] Test auth route redirects for logged-in users

### Phase 5: Data Updates
- [ ] Create `getCurrentUser()` and `requireAuth()` helpers
- [ ] Update jobs page to fetch user-specific data
- [ ] Update all server actions to use real user ID
- [ ] Update board, today pages
- [ ] Remove all `TEMP_USER_ID` references

### Phase 6: UI Updates
- [ ] Update UserProfileMenu with real user data
- [ ] Add sign out functionality
- [ ] Show user avatar/initials

### Phase 7: Landing Page
- [ ] Create public landing page
- [ ] Redirect logged-in users to /jobs

### Testing
- [ ] Sign up with email → verify email → login works
- [ ] Sign up with Google → redirects to /jobs
- [ ] Protected routes redirect to login
- [ ] User only sees their own jobs
- [ ] Sign out clears session
- [ ] Different users have separate data

---

## Migration Strategy (Existing Data)

Since we currently have `TEMP_USER_ID` data:

**Option A: Fresh Start**
- Delete all existing jobs/activities
- Users start fresh with their own accounts
- Simplest approach for MVP

**Option B: Claim Existing Data**
- First user to sign up can "claim" existing data
- One-time migration prompt
- More complex but preserves demo data

**Recommendation:** Option A for simplicity. The app is in development, no real user data to preserve.

---

## Supabase Dashboard Configuration

### 1. Enable Google OAuth

**In Supabase Dashboard** (`https://supabase.com/dashboard/project/myxbtnqaruddbwmxoijs`):

1. Go to **Authentication → Providers → Google**
2. Toggle **Enable Google**
3. Enter your existing credentials:
   - Client ID: `442976926416-t4a4rfgmkir3qpph1c8ncmnrn68m3v84.apps.googleusercontent.com`
   - Client Secret: `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`
4. Save

**In Google Cloud Console** (`https://console.cloud.google.com`):

1. Go to **APIs & Services → Credentials**
2. Click on your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://myxbtnqaruddbwmxoijs.supabase.co/auth/v1/callback
   ```
4. Save

### 2. Enable Microsoft OAuth

**In Supabase Dashboard**:

1. Go to **Authentication → Providers → Azure (Microsoft)**
2. Toggle **Enable Azure**
3. Enter your existing credentials:
   - Client ID: `4d6b5025-8c4d-4560-957d-52c666cf81ec`
   - Client Secret: `c421fd49-2503-4bd2-8b69-d2be81912ebd`
   - URL: `https://login.microsoftonline.com/common` (for any Microsoft account)
4. Save

**In Azure Portal** (`https://portal.azure.com`):

1. Go to **Azure Active Directory → App registrations → Your App**
2. Click **Authentication**
3. Add to **Redirect URIs**:
   ```
   https://myxbtnqaruddbwmxoijs.supabase.co/auth/v1/callback
   ```
4. Save

### 3. URL Configuration

**In Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL**:
   - Development: `http://localhost:3000`
   - Production: `https://trackd.app` (or your domain)

2. **Redirect URLs** (add all):
   ```
   http://localhost:3000/auth/callback
   https://trackd.app/auth/callback
   http://localhost:3000/jobs
   https://trackd.app/jobs
   ```

### 4. Disable Email Confirmation (Per User Request)

**In Supabase Dashboard → Authentication → Settings**:

1. Find **Email Confirmations**
2. Toggle OFF "Enable email confirmations"
3. Save

This allows users to sign in immediately without verifying email.

---

## Security Considerations

1. **Row Level Security (RLS)**: Enable in Supabase for extra protection
2. **Server-side validation**: Always verify user owns resource before CRUD
3. **Rate limiting**: Supabase has built-in rate limiting for auth
4. **HTTPS**: Required for OAuth in production
5. **Environment variables**: Never expose service role key to client

---

## Timeline Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| 1. Setup | Install deps, create clients | 30 min |
| 2. Database | Schema updates, migration | 1 hour |
| 3. Auth UI | Login, signup, callback | 2 hours |
| 4. Middleware | Route protection | 30 min |
| 5. Data Updates | User-scoped queries | 2 hours |
| 6. UI Updates | Profile menu, logout | 1 hour |
| 7. Landing Page | Public home page | 1 hour |
| Testing | E2E auth flow testing | 1 hour |

**Total: ~9 hours**

---

## After Auth: Extension Integration

Once auth is working:
1. Users have real accounts with unique IDs
2. Extension key generation uses real user ID
3. Jobs saved via extension go to correct user
4. Everything just works!

---

## Quick Reference: Implementation Order

### Pre-Implementation (Manual Steps)

Do these in browser BEFORE writing code:

```
[ ] 1. Supabase Dashboard: Enable Google provider with existing credentials
[ ] 2. Supabase Dashboard: Enable Azure/Microsoft provider with existing credentials
[ ] 3. Supabase Dashboard: Set Site URL to http://localhost:3000
[ ] 4. Supabase Dashboard: Add redirect URLs (localhost + production)
[ ] 5. Supabase Dashboard: Disable email confirmation
[ ] 6. Google Cloud Console: Add Supabase callback URL to redirect URIs
[ ] 7. Azure Portal: Add Supabase callback URL to redirect URIs
[ ] 8. Supabase Dashboard: Copy service_role key to .env
```

### Code Implementation Order

```
[ ] 1. Install @supabase/ssr
[ ] 2. Update .env with proper variable names
[ ] 3. Create Supabase client utilities:
       - src/lib/supabase/client.ts (browser)
       - src/lib/supabase/server.ts (server)
       - src/lib/supabase/middleware.ts (middleware)
[ ] 4. Create middleware.ts for route protection
[ ] 5. Create auth helper: src/lib/auth.ts
[ ] 6. Create auth pages:
       - src/app/(auth)/login/page.tsx
       - src/app/(auth)/signup/page.tsx
       - src/app/auth/callback/route.ts
[ ] 7. Create auth components:
       - src/components/auth/login-form.tsx
       - src/components/auth/signup-form.tsx
[ ] 8. Update landing page (src/app/page.tsx)
[ ] 9. Update jobs page to use requireAuth()
[ ] 10. Update all server actions (remove TEMP_USER_ID)
[ ] 11. Update UserProfileMenu with real user data
[ ] 12. Delete existing test data from database
[ ] 13. Test full auth flow
```

### Files to Modify (TEMP_USER_ID References)

These files currently use `TEMP_USER_ID` and need to be updated:

```
src/lib/constants.ts                          # Remove TEMP_USER_ID constant
src/app/(authenticated)/jobs/actions.ts       # Use real userId
src/app/(authenticated)/jobs/page.tsx         # Use requireAuth()
src/app/(authenticated)/board/page.tsx        # Use requireAuth()
src/app/(authenticated)/board/actions.ts      # Use real userId
src/app/(authenticated)/today/page.tsx        # Use requireAuth()
src/app/api/auth/email/oauth/route.ts         # Use real userId
src/app/api/auth/email/oauth/callback/route.ts # Use real userId
src/app/api/jobs/from-extension/route.ts      # Use extension key auth
src/app/api/cron/sync-emails/route.ts         # Use real userId
```

### Database Changes

```
[ ] 1. No schema changes needed (User model optional)
[ ] 2. Existing jobs/activities can be deleted (fresh start)
[ ] 3. Or: Create migration to update userId from TEMP_USER_ID to real ID
```

---

## Summary

| What | Before | After |
|------|--------|-------|
| User Auth | Everyone = TEMP_USER_ID | Real Supabase Auth |
| Sign In | None | Google, Microsoft, Email |
| Data Isolation | All shared | Per-user |
| Protected Routes | None | Middleware enforced |
| Extension | Works (wrong user) | Works (correct user) |
| Email Sync | Works (wrong user) | Works (correct user) |

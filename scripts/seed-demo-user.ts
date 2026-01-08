/**
 * Seed Demo User Script
 * 
 * Creates a complete demo user with realistic job tracking data for screenshots.
 * 
 * Usage: 
 *   bun run scripts/seed-demo-user.ts
 *   bun run scripts/seed-demo-user.ts --user-id=<existing-user-id>
 * 
 * Required env vars:
 * - DATABASE_URL
 * 
 * Optional (for creating new auth user):
 * - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * If no service role key is provided, you can:
 * 1. Sign up manually with the demo email
 * 2. Run this script with --user-id=<your-user-id>
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Demo user details
const DEMO_USER = {
  email: 'alex.morgan.demo@gmail.com',
  password: 'DemoUser2024!',
  name: 'Alex Morgan',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=b6e3f4'
}

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2)
  const result: { userId?: string } = {}
  
  for (const arg of args) {
    if (arg.startsWith('--user-id=')) {
      result.userId = arg.replace('--user-id=', '')
    }
  }
  
  return result
}

// Create Prisma client
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const pool = new Pool({ connectionString, max: 5 })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

// Create Supabase admin client (returns null if not configured)
function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceKey) {
    return null
  }
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Generate realistic job data
const DEMO_JOBS = [
  // SAVED jobs (just discovered, haven't applied yet)
  {
    title: 'Senior Full-Stack Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA (Remote)',
    source: 'LINKEDIN',
    url: 'https://stripe.com/jobs/senior-fullstack',
    status: 'SAVED',
    priority: 'A',
    salary: '$180,000 - $240,000',
    tags: ['React', 'Node.js', 'TypeScript', 'Payments'],
    notes: 'Great company culture, strong engineering team. Need to update resume with more payments experience.',
    savedAt: daysAgo(2),
  },
  {
    title: 'Staff Software Engineer',
    company: 'Figma',
    location: 'San Francisco, CA (Hybrid)',
    source: 'COMPANY_SITE',
    url: 'https://figma.com/careers/staff-eng',
    status: 'SAVED',
    priority: 'A',
    salary: '$200,000 - $280,000',
    tags: ['WebGL', 'TypeScript', 'Performance', 'Design Tools'],
    notes: 'Dream job! Interesting technical challenges with canvas rendering.',
    savedAt: daysAgo(1),
  },
  {
    title: 'Backend Engineer',
    company: 'Linear',
    location: 'Remote (US)',
    source: 'LINKEDIN',
    url: 'https://linear.app/careers/backend',
    status: 'SAVED',
    priority: 'B',
    salary: '$150,000 - $200,000',
    tags: ['Node.js', 'PostgreSQL', 'GraphQL'],
    notes: 'Love their product. Small team, fast-paced.',
    savedAt: daysAgo(0),
  },

  // APPLIED jobs (waiting to hear back)
  {
    title: 'Senior Software Engineer',
    company: 'Vercel',
    location: 'Remote',
    source: 'COMPANY_SITE',
    url: 'https://vercel.com/careers/senior-swe',
    status: 'APPLIED',
    priority: 'A',
    salary: '$170,000 - $230,000',
    tags: ['Next.js', 'React', 'Edge Computing', 'TypeScript'],
    notes: 'Applied with referral from Jake. Mentioned my open source Next.js contributions.',
    savedAt: daysAgo(14),
    appliedAt: daysAgo(12),
    contactName: 'Sarah Chen',
    contactEmail: 'recruiting@vercel.com',
  },
  {
    title: 'Full-Stack Developer',
    company: 'Notion',
    location: 'San Francisco, CA (Hybrid)',
    source: 'REFERRAL',
    url: 'https://notion.so/careers/fullstack',
    status: 'APPLIED',
    priority: 'A',
    salary: '$165,000 - $220,000',
    tags: ['React', 'Rust', 'WASM', 'Collaboration'],
    notes: 'Referred by Maria from college. Had a call with recruiter, seems promising.',
    savedAt: daysAgo(10),
    appliedAt: daysAgo(8),
    contactName: 'David Park',
    contactEmail: 'david.park@notion.so',
  },
  {
    title: 'Platform Engineer',
    company: 'Datadog',
    location: 'New York, NY (Remote)',
    source: 'LINKEDIN',
    url: 'https://datadoghq.com/careers/platform',
    status: 'APPLIED',
    priority: 'B',
    salary: '$160,000 - $210,000',
    tags: ['Go', 'Kubernetes', 'Observability', 'Distributed Systems'],
    notes: 'Good comp, interesting technical challenges. Waiting on initial response.',
    savedAt: daysAgo(7),
    appliedAt: daysAgo(5),
  },
  {
    title: 'Software Engineer II',
    company: 'Airbnb',
    location: 'San Francisco, CA (Hybrid)',
    source: 'RECRUITER',
    url: 'https://airbnb.com/careers/swe2',
    status: 'APPLIED',
    priority: 'B',
    salary: '$175,000 - $225,000',
    tags: ['React', 'Ruby', 'GraphQL', 'Travel Tech'],
    notes: 'Recruiter reached out on LinkedIn. Submitted application through their portal.',
    savedAt: daysAgo(6),
    appliedAt: daysAgo(4),
    contactName: 'Lisa Wong',
    contactEmail: 'lisa.wong@airbnb.com',
  },

  // INTERVIEW jobs (active interview process)
  {
    title: 'Senior Frontend Engineer',
    company: 'Shopify',
    location: 'Remote (North America)',
    source: 'LINKEDIN',
    url: 'https://shopify.com/careers/senior-fe',
    status: 'INTERVIEW',
    priority: 'A',
    salary: '$180,000 - $250,000',
    tags: ['React', 'TypeScript', 'GraphQL', 'E-commerce'],
    notes: 'Phone screen went great! Technical interview scheduled for next week. Need to review system design.',
    savedAt: daysAgo(21),
    appliedAt: daysAgo(18),
    interviewAt: daysFromNow(3),
    nextAction: 'Prepare system design - e-commerce checkout flow',
    contactName: 'Mike Johnson',
    contactEmail: 'mike.johnson@shopify.com',
  },
  {
    title: 'Staff Engineer, Growth',
    company: 'Spotify',
    location: 'New York, NY (Hybrid)',
    source: 'REFERRAL',
    url: 'https://spotify.com/jobs/staff-growth',
    status: 'INTERVIEW',
    priority: 'A',
    salary: '$200,000 - $270,000',
    tags: ['Python', 'ML', 'A/B Testing', 'Data Engineering'],
    notes: 'Passed phone screen and coding round. On-site scheduled! Practice behavioral questions.',
    savedAt: daysAgo(28),
    appliedAt: daysAgo(25),
    interviewAt: daysFromNow(5),
    nextAction: 'Review STAR method answers, research Spotify\'s growth initiatives',
    contactName: 'Emma Davis',
    contactEmail: 'emma.davis@spotify.com',
  },
  {
    title: 'Software Engineer',
    company: 'Discord',
    location: 'San Francisco, CA (Remote)',
    source: 'COMPANY_SITE',
    url: 'https://discord.com/careers/swe',
    status: 'INTERVIEW',
    priority: 'B',
    salary: '$160,000 - $210,000',
    tags: ['Elixir', 'Rust', 'WebSockets', 'Real-time'],
    notes: 'Had initial phone screen. Waiting for technical round scheduling.',
    savedAt: daysAgo(18),
    appliedAt: daysAgo(15),
    interviewAt: null,
    nextAction: 'Follow up on interview scheduling',
    contactName: 'Chris Taylor',
    contactEmail: 'recruiting@discord.com',
  },

  // OFFER jobs
  {
    title: 'Senior Software Engineer',
    company: 'GitLab',
    location: 'Remote (Worldwide)',
    source: 'LINKEDIN',
    url: 'https://gitlab.com/jobs/senior-swe',
    status: 'OFFER',
    priority: 'A',
    salary: '$175,000 + equity',
    tags: ['Ruby', 'Go', 'DevOps', 'Open Source'],
    notes: 'OFFER RECEIVED! $175k base + $50k equity. Great remote culture, unlimited PTO. Need to decide by Friday.',
    savedAt: daysAgo(35),
    appliedAt: daysAgo(32),
    interviewAt: daysAgo(14),
    nextAction: 'Compare with other offers, negotiate equity',
    contactName: 'Rachel Kim',
    contactEmail: 'rachel.kim@gitlab.com',
  },

  // REJECTED jobs
  {
    title: 'Principal Engineer',
    company: 'Netflix',
    location: 'Los Gatos, CA',
    source: 'RECRUITER',
    url: 'https://netflix.com/jobs/principal',
    status: 'REJECTED',
    priority: 'A',
    salary: '$350,000 - $500,000',
    tags: ['Java', 'Microservices', 'Streaming', 'Scale'],
    notes: 'Got to final round but didn\'t get the offer. Feedback: Need more experience with video streaming at scale.',
    savedAt: daysAgo(45),
    appliedAt: daysAgo(42),
    interviewAt: daysAgo(21),
  },
  {
    title: 'Engineering Manager',
    company: 'Meta',
    location: 'Menlo Park, CA (Hybrid)',
    source: 'LINKEDIN',
    url: 'https://meta.com/careers/em',
    status: 'REJECTED',
    priority: 'A',
    salary: '$250,000 - $350,000',
    tags: ['Management', 'React', 'Mobile', 'Leadership'],
    notes: 'Made it to on-site. Position filled internally. Recruiter said they\'d reach out for future roles.',
    savedAt: daysAgo(60),
    appliedAt: daysAgo(55),
    interviewAt: daysAgo(30),
  },
  {
    title: 'Senior Backend Engineer',
    company: 'Robinhood',
    location: 'Menlo Park, CA (Hybrid)',
    source: 'COMPANY_SITE',
    url: 'https://robinhood.com/careers/backend',
    status: 'REJECTED',
    priority: 'B',
    salary: '$180,000 - $230,000',
    tags: ['Python', 'Django', 'FinTech', 'Trading'],
    notes: 'Didn\'t pass technical screen. Need to study more system design for financial systems.',
    savedAt: daysAgo(50),
    appliedAt: daysAgo(48),
  },

  // ARCHIVED jobs (no longer interested)
  {
    title: 'Software Developer',
    company: 'Oracle',
    location: 'Austin, TX',
    source: 'LINKEDIN',
    url: 'https://oracle.com/careers/dev',
    status: 'ARCHIVED',
    priority: 'C',
    salary: '$130,000 - $170,000',
    tags: ['Java', 'Enterprise', 'Cloud'],
    notes: 'After research, decided the role wasn\'t a good fit. Too enterprise-focused.',
    savedAt: daysAgo(30),
  },
  {
    title: 'Full-Stack Engineer',
    company: 'Startup XYZ',
    location: 'Remote',
    source: 'RECRUITER',
    url: 'https://startupxyz.com/careers',
    status: 'ARCHIVED',
    priority: 'C',
    salary: '$120,000 - $150,000',
    tags: ['React', 'Node.js', 'Startup'],
    notes: 'Company had funding issues. Decided to pass.',
    savedAt: daysAgo(25),
  },
]

// Helper functions for dates
function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function daysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

// Generate activities for a job based on its status
function generateActivities(jobId: string, userId: string, job: typeof DEMO_JOBS[0]): any[] {
  const activities: any[] = []
  
  // Initial save
  activities.push({
    jobId,
    userId,
    type: 'NOTE',
    description: `Discovered this role at ${job.company}. ${job.notes?.split('.')[0] || 'Looks promising!'}.`,
    createdAt: job.savedAt,
  })

  if (job.appliedAt) {
    activities.push({
      jobId,
      userId,
      type: 'STATUS_CHANGE',
      fromStatus: 'SAVED',
      toStatus: 'APPLIED',
      description: 'Submitted application',
      createdAt: job.appliedAt,
    })
  }

  if (job.status === 'INTERVIEW' || job.status === 'OFFER' || job.status === 'REJECTED') {
    activities.push({
      jobId,
      userId,
      type: 'STATUS_CHANGE',
      fromStatus: 'APPLIED',
      toStatus: 'INTERVIEW',
      description: 'Got a response! Moving to interview stage.',
      createdAt: new Date(job.appliedAt!.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days after applying
    })

    if (job.status === 'INTERVIEW') {
      activities.push({
        jobId,
        userId,
        type: 'INTERVIEW',
        description: 'Phone screen completed - went well!',
        metadata: { interviewType: 'phone_screen', duration: '30 mins' },
        createdAt: new Date(job.appliedAt!.getTime() + 5 * 24 * 60 * 60 * 1000),
      })
    }
  }

  if (job.status === 'OFFER') {
    activities.push({
      jobId,
      userId,
      type: 'INTERVIEW',
      description: 'Final round interview - great conversations with the team!',
      metadata: { interviewType: 'onsite', duration: '4 hours' },
      createdAt: daysAgo(16),
    })
    activities.push({
      jobId,
      userId,
      type: 'OFFER',
      fromStatus: 'INTERVIEW',
      toStatus: 'OFFER',
      description: 'Received offer! 🎉',
      metadata: { salary: job.salary, deadline: daysFromNow(3).toISOString() },
      createdAt: daysAgo(3),
    })
  }

  if (job.status === 'REJECTED') {
    activities.push({
      jobId,
      userId,
      type: 'REJECTION',
      fromStatus: 'INTERVIEW',
      toStatus: 'REJECTED',
      description: 'Did not proceed - position filled',
      createdAt: job.interviewAt ? new Date(job.interviewAt.getTime() + 7 * 24 * 60 * 60 * 1000) : daysAgo(7),
    })
  }

  return activities
}

// Generate notifications
function generateNotifications(userId: string): any[] {
  return [
    {
      userId,
      type: 'NEW_JOB_DETECTED',
      title: 'New job opportunity detected',
      message: 'We found a Senior Engineer role at Stripe matching your profile from a recent email.',
      metadata: { source: 'email_scan' },
      isRead: true,
      createdAt: daysAgo(2),
    },
    {
      userId,
      type: 'JOB_UPDATED',
      title: 'Interview reminder',
      message: 'Your interview with Shopify is coming up in 3 days. Good luck!',
      actionUrl: '/jobs',
      isRead: false,
      createdAt: daysAgo(0),
    },
    {
      userId,
      type: 'SYNC_COMPLETE',
      title: 'Email sync completed',
      message: 'Processed 12 emails, found 2 job-related updates.',
      metadata: { emailsProcessed: 12, updatesFound: 2 },
      isRead: true,
      createdAt: daysAgo(1),
    },
  ]
}

async function main() {
  console.log('🌱 Seeding demo user...\n')
  
  const args = parseArgs()
  const prisma = createPrismaClient()
  const supabase = createSupabaseAdmin()

  try {
    let userId: string
    
    // If user ID provided via command line, use that
    if (args.userId) {
      console.log(`📧 Using provided user ID: ${args.userId}`)
      userId = args.userId
      
      // Check if profile exists, create if not
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId }
      })
      
      if (!existingProfile) {
        console.log('👤 Creating profile for provided user ID...')
        await prisma.profile.create({
          data: {
            id: userId,
            email: DEMO_USER.email,
            name: DEMO_USER.name,
            avatarUrl: DEMO_USER.avatarUrl,
          }
        })
        console.log('✅ Profile created')
      } else {
        console.log(`👤 Profile exists: ${existingProfile.email}`)
        // Update profile with demo user info
        await prisma.profile.update({
          where: { id: userId },
          data: {
            name: DEMO_USER.name,
            avatarUrl: DEMO_USER.avatarUrl,
          }
        })
      }
      
      // Clean up existing data
      console.log('🧹 Cleaning up existing data...')
      await prisma.notification.deleteMany({ where: { userId } })
      await prisma.activity.deleteMany({ where: { userId } })
      await prisma.job.deleteMany({ where: { userId } })
      console.log('✅ Cleaned up existing data')
    } else {
      // Check if demo user already exists by email
      const existingProfile = await prisma.profile.findUnique({
        where: { email: DEMO_USER.email }
      })

      if (existingProfile) {
        console.log('📧 Demo user already exists, cleaning up old data...')
        userId = existingProfile.id

        // Delete existing data for this user
        await prisma.notification.deleteMany({ where: { userId } })
        await prisma.activity.deleteMany({ where: { userId } })
        await prisma.job.deleteMany({ where: { userId } })
        console.log('🧹 Cleaned up existing data')
      } else if (supabase) {
        // Create user in Supabase Auth
        console.log('📧 Creating Supabase auth user...')
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: DEMO_USER.email,
          password: DEMO_USER.password,
          email_confirm: true,
          user_metadata: {
            full_name: DEMO_USER.name,
            avatar_url: DEMO_USER.avatarUrl,
          }
        })

        if (authError) {
          throw new Error(`Failed to create auth user: ${authError.message}`)
        }

        userId = authData.user.id
        console.log(`✅ Auth user created with ID: ${userId}`)

        // Create Profile in database
        console.log('👤 Creating profile...')
        await prisma.profile.create({
          data: {
            id: userId,
            email: DEMO_USER.email,
            name: DEMO_USER.name,
            avatarUrl: DEMO_USER.avatarUrl,
          }
        })
        console.log('✅ Profile created')
      } else {
        // No Supabase admin client and no existing user
        console.log('\n❌ Cannot create demo user automatically.')
        console.log('\nOptions:')
        console.log('  1. Add SUPABASE_SERVICE_ROLE_KEY to your .env file')
        console.log('     (Find it in Supabase Dashboard → Project Settings → API)')
        console.log('')
        console.log('  2. Sign up manually with:')
        console.log(`     Email: ${DEMO_USER.email}`)
        console.log(`     Password: ${DEMO_USER.password}`)
        console.log('     Then run: bun run scripts/seed-demo-user.ts --user-id=<your-user-id>')
        console.log('')
        console.log('  3. Use your own account:')
        console.log('     Run: bun run scripts/seed-demo-user.ts --user-id=<your-user-id>')
        console.log('')
        process.exit(1)
      }
    }

    // Create Jobs
    console.log('\n📋 Creating demo jobs...')
    const createdJobs: { id: string; data: typeof DEMO_JOBS[0] }[] = []

    for (const jobData of DEMO_JOBS) {
      const job = await prisma.job.create({
        data: {
          userId,
          title: jobData.title,
          company: jobData.company,
          location: jobData.location,
          source: jobData.source as any,
          url: jobData.url,
          status: jobData.status as any,
          priority: jobData.priority as any,
          salary: jobData.salary,
          tags: jobData.tags,
          notes: jobData.notes,
          savedAt: jobData.savedAt,
          appliedAt: jobData.appliedAt || null,
          interviewAt: jobData.interviewAt || null,
          nextAction: jobData.nextAction || null,
          contactName: jobData.contactName || null,
          contactEmail: jobData.contactEmail || null,
        }
      })
      createdJobs.push({ id: job.id, data: jobData })
      console.log(`  ✅ ${jobData.company} - ${jobData.title} (${jobData.status})`)
    }

    // Create Activities
    console.log('\n📝 Creating activities...')
    let activityCount = 0
    for (const { id: jobId, data: jobData } of createdJobs) {
      const activities = generateActivities(jobId, userId, jobData)
      for (const activity of activities) {
        await prisma.activity.create({ data: activity })
        activityCount++
      }
    }
    console.log(`✅ Created ${activityCount} activities`)

    // Create Notifications
    console.log('\n🔔 Creating notifications...')
    const notifications = generateNotifications(userId)
    for (const notification of notifications) {
      await prisma.notification.create({ data: notification })
    }
    console.log(`✅ Created ${notifications.length} notifications`)

    // Create Email Sync Log (fake history)
    console.log('\n📧 Creating email sync history...')
    await prisma.emailSyncLog.createMany({
      data: [
        {
          userId,
          source: 'auto',
          startedAt: daysAgo(1),
          completedAt: daysAgo(1),
          duration: 4500,
          totalEmails: 45,
          processedEmails: 12,
          skippedEmails: 28,
          skippedOther: 5,
          exactMatches: 3,
          fuzzyMatches: 1,
          jobsUpdated: 4,
          success: true,
        },
        {
          userId,
          source: 'manual',
          startedAt: daysAgo(3),
          completedAt: daysAgo(3),
          duration: 3200,
          totalEmails: 38,
          processedEmails: 8,
          skippedEmails: 25,
          skippedOther: 5,
          exactMatches: 2,
          fuzzyMatches: 2,
          jobsUpdated: 3,
          success: true,
        },
      ]
    })
    console.log('✅ Created email sync history')

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('🎉 Demo user seeded successfully!\n')
    console.log('Login credentials:')
    console.log(`  📧 Email: ${DEMO_USER.email}`)
    console.log(`  🔐 Password: ${DEMO_USER.password}`)
    console.log('\nData created:')
    console.log(`  • ${createdJobs.length} job listings`)
    console.log(`  • ${activityCount} activities`)
    console.log(`  • ${notifications.length} notifications`)
    console.log(`  • 2 email sync logs`)
    console.log('\nJob breakdown:')
    const statusCounts = DEMO_JOBS.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  • ${status}: ${count}`)
    })
    console.log('='.repeat(50))

  } catch (error) {
    console.error('❌ Error seeding demo user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


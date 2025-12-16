// Create jobs from today's rejection emails
import { prisma } from '../src/lib/prisma'

async function createTodaysJobs() {
  const userId = 'temp-user'

  console.log('Creating jobs from today\'s rejection emails...\n')

  // 1. Software Mind
  await prisma.job.create({
    data: {
      userId,
      title: 'Senior Software Engineer (Node.js / Nest.js + React)',
      company: 'Software Mind',
      source: 'OTHER',
      status: 'REJECTED',
      priority: 'B',
      notes: 'Thanks again for your interest in the [GFA] Senior Software Engineer (Node.js / Nest.js + React) position and joining our team! We\'ve had a chance to review your application, and while we\'re moving forward with other candidates, we really enjoyed learning about your background.',
    },
  })
  console.log('✓ Created: Software Mind - Senior Software Engineer (REJECTED)')

  // 2. Sunrise | Dreem Health
  await prisma.job.create({
    data: {
      userId,
      title: 'Front-End Developer',
      company: 'Sunrise | Dreem Health',
      source: 'OTHER',
      status: 'REJECTED',
      priority: 'B',
      notes: 'Thank you so much for the time and effort you put into applying for the Front-End Developer role at Sunrise | Dreem Health — your interest truly means a lot to us! After careful consideration, we regret to inform you that your profile does not align with the specific requirements of the position at this time.',
    },
  })
  console.log('✓ Created: Sunrise | Dreem Health - Front-End Developer (REJECTED)')

  // 3. Exotrail
  await prisma.job.create({
    data: {
      userId,
      title: 'Job Application',
      company: 'Exotrail',
      source: 'OTHER',
      status: 'REJECTED',
      priority: 'B',
      notes: 'We appreciate your interest in Exotrail and the time you\'ve invested in applying. You do have good skills and accomplishments, nevertheless we wanted to let you know that we are not able to offer you a position at this time.',
    },
  })
  console.log('✓ Created: Exotrail (REJECTED)')

  console.log('\n✅ All 3 rejection jobs created!')
  process.exit(0)
}

createTodaysJobs().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

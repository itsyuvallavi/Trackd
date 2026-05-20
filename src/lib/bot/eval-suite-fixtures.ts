import type { ApplicationProfile, BotConfig, BotResume } from '@prisma/client'
import type { SearchJobResult } from './types'
import type { ResumeStructuredData } from './resume/types'

export type BotEvalGoldLabel = 'good' | 'partial' | 'bad' | 'hard_filter'

export interface BotEvalGoldJob extends SearchJobResult {
  id: string
  gold: BotEvalGoldLabel
  expectedFilterReason?: string
}

export interface BotEvalPersonaFixture {
  id: string
  label: string
  applicationProfile: ApplicationProfile
  config: BotConfig
  resume: BotResume & {
    rawText: string
    structuredData: ResumeStructuredData
  }
  expectedSafeTerms: string[]
  jobs: BotEvalGoldJob[]
}

const FIXTURE_DATE = new Date('2026-05-01T00:00:00.000Z')

function applicationProfile(input: {
  id: string
  userId: string
  fullName: string
  city: string
  country: string
  workAuthorization: string
  yearsExperience: number
  salaryExpectation?: number
}): ApplicationProfile {
  return {
    id: input.id,
    userId: input.userId,
    applicationFullName: input.fullName,
    applicationEmail: `${input.id}@example.invalid`,
    portalSignupPassword: null,
    phone: '000-000-0000',
    address: null,
    city: input.city,
    state: null,
    country: input.country,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    workAuthorization: input.workAuthorization,
    requiresSponsorship: false,
    salaryExpectation: input.salaryExpectation ?? null,
    noticePeriod: '1_month',
    yearsExperience: input.yearsExperience,
    createdAt: FIXTURE_DATE,
    updatedAt: FIXTURE_DATE,
  }
}

function botConfig(input: {
  id: string
  userId: string
  keywords: string[]
  locations: string[]
  remoteOnly: boolean
  experienceLevel: string
  minScore?: number
  spokenLanguages?: string[]
  excludeKeywords?: string[]
}): BotConfig {
  return {
    id: input.id,
    userId: input.userId,
    keywords: input.keywords,
    locations: input.locations,
    excludeCompanies: [],
    excludeKeywords: input.excludeKeywords ?? [],
    spokenLanguages: input.spokenLanguages ?? ['English'],
    remoteOnly: input.remoteOnly,
    experienceLevel: input.experienceLevel,
    salaryMin: null,
    isActive: true,
    searchFrequency: 'DAILY',
    lastSearchAt: null,
    telegramChatId: null,
    minScore: input.minScore ?? 70,
    createdAt: FIXTURE_DATE,
    updatedAt: FIXTURE_DATE,
  }
}

function botResume(input: {
  id: string
  userId: string
  label: string
  matchKeywords: string[]
  structuredData: ResumeStructuredData
  rawText: string
}): BotEvalPersonaFixture['resume'] {
  return {
    id: input.id,
    userId: input.userId,
    label: input.label,
    matchKeywords: input.matchKeywords,
    isDefault: true,
    fileUrl: `https://files.example.invalid/${input.id}.pdf`,
    fileName: `${input.id}.pdf`,
    rawText: input.rawText,
    structuredData: input.structuredData,
    createdAt: FIXTURE_DATE,
    updatedAt: FIXTURE_DATE,
  } as BotEvalPersonaFixture['resume']
}

function job(input: {
  id: string
  gold: BotEvalGoldLabel
  title: string
  company: string
  location: string
  description: string
  isRemote?: boolean
  expectedFilterReason?: string
}): BotEvalGoldJob {
  return {
    id: input.id,
    gold: input.gold,
    expectedFilterReason: input.expectedFilterReason,
    title: input.title,
    company: input.company,
    location: input.location,
    url: `https://jobs.example.invalid/${input.id}`,
    description: input.description,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    source: 'synthetic_eval',
    posted_date: '2026-05-01',
    job_type: 'Full-time',
    is_remote: input.isRemote ?? false,
    company_logo: null,
    jobBoard: 'synthetic',
    providerPass: null,
  }
}

export const BOT_EVAL_PERSONA_FIXTURES: BotEvalPersonaFixture[] = [
  {
    id: 'frontend-react-europe',
    label: 'React/Next/TypeScript frontend engineer, remote Europe',
    applicationProfile: applicationProfile({
      id: 'profile-frontend',
      userId: 'eval-user-frontend',
      fullName: 'Synthetic Frontend Candidate',
      city: 'Lisbon',
      country: 'Portugal',
      workAuthorization: 'EU work authorization',
      yearsExperience: 5,
    }),
    config: botConfig({
      id: 'config-frontend',
      userId: 'eval-user-frontend',
      keywords: ['Frontend Engineer', 'React Developer', 'Next.js Engineer'],
      locations: ['Remote Europe', 'Portugal', 'Lisbon'],
      remoteOnly: true,
      experienceLevel: 'mid_level',
      spokenLanguages: ['English'],
    }),
    resume: botResume({
      id: 'eval_resume_frontend',
      userId: 'eval-user-frontend',
      label: 'Frontend React',
      matchKeywords: ['frontend', 'react', 'next.js'],
      structuredData: {
        name: 'Synthetic Frontend Candidate',
        email: 'frontend-candidate@example.invalid',
        phone: '000-000-0000',
        location: 'Lisbon, Portugal',
        summary: 'Frontend engineer focused on React, Next.js, TypeScript, accessibility, and design systems.',
        skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Accessibility', 'Testing Library'],
        languages: ['English'],
        experience: [{
          company: 'Synthetic Product Studio',
          title: 'Frontend Engineer',
          startDate: '2021-04',
          endDate: 'Present',
          description: 'Built dashboard UI, component systems, and data-heavy React workflows.',
          achievements: ['Improved Core Web Vitals and shipped accessible reusable components.'],
        }],
        education: [{
          institution: 'Synthetic Technical Institute',
          degree: 'BSc',
          field: 'Computer Science',
        }],
        certifications: [],
      },
      rawText: 'Frontend Engineer with React, Next.js, TypeScript, Tailwind CSS, accessibility, design systems, and testing experience.',
    }),
    expectedSafeTerms: [
      'React TypeScript Developer',
      'Next.js Frontend Engineer',
      'Frontend Engineer',
    ],
    jobs: [
      job({
        id: 'frontend-good',
        gold: 'good',
        title: 'Remote Frontend Engineer, React and Next.js',
        company: 'Northstar Apps',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Build customer-facing React and Next.js interfaces in TypeScript with accessibility and testing ownership.',
      }),
      job({
        id: 'frontend-bad',
        gold: 'bad',
        title: 'Embedded Firmware Engineer',
        company: 'Circuit Works',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Develop C firmware for microcontrollers, device drivers, and hardware validation tooling.',
      }),
      job({
        id: 'frontend-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'Frontend Engineer, Onsite',
        company: 'Metro Retail Systems',
        location: 'New York, NY, United States',
        description: 'Onsite React role requiring five days per week in a New York office.',
      }),
    ],
  },
  {
    id: 'fullstack-typescript-product',
    label: 'Full-stack TypeScript/backend product engineer',
    applicationProfile: applicationProfile({
      id: 'profile-fullstack',
      userId: 'eval-user-fullstack',
      fullName: 'Synthetic Fullstack Candidate',
      city: 'Berlin',
      country: 'Germany',
      workAuthorization: 'EU work authorization',
      yearsExperience: 6,
    }),
    config: botConfig({
      id: 'config-fullstack',
      userId: 'eval-user-fullstack',
      keywords: ['Full Stack Engineer', 'Backend TypeScript Engineer', 'Product Engineer'],
      locations: ['Remote Europe', 'Berlin'],
      remoteOnly: false,
      experienceLevel: 'senior',
    }),
    resume: botResume({
      id: 'eval_resume_fullstack',
      userId: 'eval-user-fullstack',
      label: 'Fullstack TypeScript',
      matchKeywords: ['full stack', 'typescript', 'backend'],
      structuredData: {
        name: 'Synthetic Fullstack Candidate',
        email: 'fullstack-candidate@example.invalid',
        location: 'Berlin, Germany',
        summary: 'Product-minded full-stack engineer working across TypeScript, Node.js, PostgreSQL, and React.',
        skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'React', 'Prisma', 'REST APIs'],
        languages: ['English'],
        experience: [{
          company: 'Synthetic Workflow Labs',
          title: 'Senior Product Engineer',
          startDate: '2020-02',
          endDate: 'Present',
          description: 'Owned backend services, data models, and frontend product workflows for a B2B SaaS application.',
        }],
        education: [{ institution: 'Synthetic University', degree: 'BEng', field: 'Software Engineering' }],
      },
      rawText: 'Senior product engineer with TypeScript, Node.js, PostgreSQL, Prisma, React, REST APIs, and SaaS product delivery.',
    }),
    expectedSafeTerms: ['Full Stack Engineer', 'Backend TypeScript Engineer', 'Full Stack Product Engineer'],
    jobs: [
      job({
        id: 'fullstack-good',
        gold: 'good',
        title: 'Senior Full Stack Product Engineer',
        company: 'Ledgerly',
        location: 'Berlin, Germany',
        description: 'Own TypeScript services, PostgreSQL schemas, React workflows, and pragmatic product delivery.',
      }),
      job({
        id: 'fullstack-bad',
        gold: 'bad',
        title: 'Sales Development Representative',
        company: 'Pipeline Market',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Prospect accounts, qualify leads, and run outbound sales campaigns for software products.',
      }),
      job({
        id: 'fullstack-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'Backend TypeScript Engineer',
        company: 'Local Commerce',
        location: 'Toronto, Canada',
        description: 'Hybrid backend engineering role requiring three office days per week in Toronto.',
      }),
    ],
  },
  {
    id: 'python-ml-data-scientist',
    label: 'Python ML/data scientist',
    applicationProfile: applicationProfile({
      id: 'profile-ml',
      userId: 'eval-user-ml',
      fullName: 'Synthetic ML Candidate',
      city: 'Madrid',
      country: 'Spain',
      workAuthorization: 'EU work authorization',
      yearsExperience: 4,
    }),
    config: botConfig({
      id: 'config-ml',
      userId: 'eval-user-ml',
      keywords: ['Machine Learning Engineer', 'Data Scientist', 'Python ML Engineer'],
      locations: ['Remote Europe', 'Madrid'],
      remoteOnly: true,
      experienceLevel: 'mid_level',
    }),
    resume: botResume({
      id: 'eval_resume_ml',
      userId: 'eval-user-ml',
      label: 'Python ML',
      matchKeywords: ['machine learning', 'data scientist', 'python'],
      structuredData: {
        name: 'Synthetic ML Candidate',
        email: 'ml-candidate@example.invalid',
        location: 'Madrid, Spain',
        summary: 'Data scientist with Python, scikit-learn, SQL, experimentation, and production ML experience.',
        skills: ['Python', 'SQL', 'scikit-learn', 'Pandas', 'A/B testing', 'ML pipelines'],
        languages: ['English', 'Spanish'],
        experience: [{
          company: 'Synthetic Analytics Group',
          title: 'Data Scientist',
          startDate: '2022-01',
          endDate: 'Present',
          description: 'Built predictive models, feature pipelines, and experiment analysis for product teams.',
        }],
        education: [{ institution: 'Synthetic Data School', degree: 'MSc', field: 'Statistics' }],
      },
      rawText: 'Data scientist using Python, SQL, Pandas, scikit-learn, A/B testing, feature engineering, and ML pipelines.',
    }),
    expectedSafeTerms: ['Data Scientist', 'Machine Learning Engineer'],
    jobs: [
      job({
        id: 'ml-good',
        gold: 'good',
        title: 'Machine Learning Data Scientist',
        company: 'Signal Metrics',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Use Python, SQL, experimentation, and scikit-learn to build product-facing ML models.',
      }),
      job({
        id: 'ml-bad',
        gold: 'bad',
        title: 'Senior iOS Engineer',
        company: 'Pocket Studio',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Build Swift and SwiftUI mobile features with deep Apple platform expertise.',
      }),
      job({
        id: 'ml-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'Data Scientist',
        company: 'Bay Research',
        location: 'San Francisco, CA, United States',
        description: 'Onsite data science role requiring relocation to San Francisco.',
      }),
    ],
  },
  {
    id: 'product-manager',
    label: 'Product manager',
    applicationProfile: applicationProfile({
      id: 'profile-pm',
      userId: 'eval-user-pm',
      fullName: 'Synthetic Product Candidate',
      city: 'Amsterdam',
      country: 'Netherlands',
      workAuthorization: 'EU work authorization',
      yearsExperience: 7,
    }),
    config: botConfig({
      id: 'config-pm',
      userId: 'eval-user-pm',
      keywords: ['Product Manager', 'Senior Product Manager', 'Platform Product Manager'],
      locations: ['Remote Europe', 'Amsterdam'],
      remoteOnly: false,
      experienceLevel: 'senior',
    }),
    resume: botResume({
      id: 'eval_resume_pm',
      userId: 'eval-user-pm',
      label: 'Product Management',
      matchKeywords: ['product manager', 'platform', 'roadmap'],
      structuredData: {
        name: 'Synthetic Product Candidate',
        email: 'pm-candidate@example.invalid',
        location: 'Amsterdam, Netherlands',
        summary: 'Product manager for B2B SaaS platforms, discovery, roadmaps, analytics, and cross-functional delivery.',
        skills: ['Product strategy', 'Roadmapping', 'User research', 'Analytics', 'B2B SaaS', 'Stakeholder management'],
        languages: ['English'],
        experience: [{
          company: 'Synthetic Platform Co',
          title: 'Product Manager',
          startDate: '2019-06',
          endDate: 'Present',
          description: 'Led roadmap discovery, metrics reviews, and delivery for internal and customer-facing platform teams.',
        }],
        education: [{ institution: 'Synthetic Business School', degree: 'MBA', field: 'Technology Management' }],
      },
      rawText: 'Product manager with B2B SaaS, product strategy, roadmapping, user research, analytics, and stakeholder management.',
    }),
    expectedSafeTerms: ['B2B SaaS Product Manager', 'Platform Product Manager', 'Product Manager'],
    jobs: [
      job({
        id: 'pm-good',
        gold: 'good',
        title: 'Senior Product Manager, SaaS Platform',
        company: 'Orbit Desk',
        location: 'Amsterdam, Netherlands',
        description: 'Lead discovery, roadmap planning, analytics, and delivery for a B2B SaaS platform team.',
      }),
      job({
        id: 'pm-bad',
        gold: 'bad',
        title: 'Payroll Accountant',
        company: 'Balance Office',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Own payroll processing, monthly reconciliations, and statutory finance reporting.',
      }),
      job({
        id: 'pm-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'Product Manager',
        company: 'Harbor Tools',
        location: 'Sydney, Australia',
        description: 'Hybrid product role requiring weekly office attendance in Sydney.',
      }),
    ],
  },
  {
    id: 'qa-automation',
    label: 'QA automation engineer',
    applicationProfile: applicationProfile({
      id: 'profile-qa',
      userId: 'eval-user-qa',
      fullName: 'Synthetic QA Candidate',
      city: 'Dublin',
      country: 'Ireland',
      workAuthorization: 'EU work authorization',
      yearsExperience: 5,
    }),
    config: botConfig({
      id: 'config-qa',
      userId: 'eval-user-qa',
      keywords: ['QA Automation Engineer', 'SDET', 'Test Automation Engineer'],
      locations: ['Remote Europe', 'Dublin'],
      remoteOnly: true,
      experienceLevel: 'mid_level',
    }),
    resume: botResume({
      id: 'eval_resume_qa',
      userId: 'eval-user-qa',
      label: 'QA Automation',
      matchKeywords: ['qa automation', 'sdet', 'playwright'],
      structuredData: {
        name: 'Synthetic QA Candidate',
        email: 'qa-candidate@example.invalid',
        location: 'Dublin, Ireland',
        summary: 'QA automation engineer building Playwright, Cypress, API, and CI test coverage for web products.',
        skills: ['Playwright', 'Cypress', 'TypeScript', 'API testing', 'CI', 'Test planning'],
        languages: ['English'],
        experience: [{
          company: 'Synthetic Quality Works',
          title: 'QA Automation Engineer',
          startDate: '2020-09',
          endDate: 'Present',
          description: 'Created end-to-end, API, and regression suites integrated with CI pipelines.',
        }],
        education: [{ institution: 'Synthetic Tech College', degree: 'BSc', field: 'Information Systems' }],
      },
      rawText: 'QA automation engineer with Playwright, Cypress, TypeScript, API testing, CI pipelines, and test planning.',
    }),
    expectedSafeTerms: [
      'QA Automation Engineer',
      'Software Engineer in Test',
      'Test Automation Engineer',
      'SDET',
      'Playwright QA Engineer',
    ],
    jobs: [
      job({
        id: 'qa-good',
        gold: 'good',
        title: 'QA Automation Engineer',
        company: 'Checkline Software',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Build Playwright and API automation in TypeScript, improve CI reliability, and plan regression coverage.',
      }),
      job({
        id: 'qa-bad',
        gold: 'bad',
        title: 'Brand Marketing Manager',
        company: 'Launch Narrative',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Own campaigns, brand messaging, channel calendars, and agency relationships.',
      }),
      job({
        id: 'qa-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'SDET',
        company: 'Test Harbor',
        location: 'Austin, TX, United States',
        description: 'Onsite SDET role requiring daily attendance in Austin.',
      }),
    ],
  },
  {
    id: 'devops-sre',
    label: 'DevOps/SRE',
    applicationProfile: applicationProfile({
      id: 'profile-sre',
      userId: 'eval-user-sre',
      fullName: 'Synthetic SRE Candidate',
      city: 'Stockholm',
      country: 'Sweden',
      workAuthorization: 'EU work authorization',
      yearsExperience: 6,
    }),
    config: botConfig({
      id: 'config-sre',
      userId: 'eval-user-sre',
      keywords: ['Site Reliability Engineer', 'DevOps Engineer', 'Platform Engineer'],
      locations: ['Remote Europe', 'Stockholm'],
      remoteOnly: true,
      experienceLevel: 'senior',
    }),
    resume: botResume({
      id: 'eval_resume_sre',
      userId: 'eval-user-sre',
      label: 'DevOps SRE',
      matchKeywords: ['sre', 'devops', 'kubernetes'],
      structuredData: {
        name: 'Synthetic SRE Candidate',
        email: 'sre-candidate@example.invalid',
        location: 'Stockholm, Sweden',
        summary: 'SRE and platform engineer with Kubernetes, Terraform, AWS, observability, and incident response experience.',
        skills: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'Incident response', 'CI/CD'],
        languages: ['English'],
        experience: [{
          company: 'Synthetic Reliability Systems',
          title: 'Site Reliability Engineer',
          startDate: '2019-03',
          endDate: 'Present',
          description: 'Operated Kubernetes platforms, Terraform modules, observability, and production incident processes.',
        }],
        education: [{ institution: 'Synthetic Engineering School', degree: 'BSc', field: 'Computer Engineering' }],
      },
      rawText: 'SRE with Kubernetes, Terraform, AWS, Prometheus, CI/CD, observability, and incident response experience.',
    }),
    expectedSafeTerms: ['Site Reliability Engineer', 'DevOps Engineer'],
    jobs: [
      job({
        id: 'sre-good',
        gold: 'good',
        title: 'Senior Site Reliability Engineer',
        company: 'Uptime Cloud',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Run Kubernetes platforms on AWS using Terraform, Prometheus, CI/CD, and incident response practices.',
      }),
      job({
        id: 'sre-bad',
        gold: 'bad',
        title: 'Customer Support Specialist',
        company: 'Helpfront',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Answer customer tickets, maintain help center articles, and triage billing questions.',
      }),
      job({
        id: 'sre-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'DevOps Engineer',
        company: 'Rack Operations',
        location: 'Singapore',
        description: 'Datacenter-focused DevOps role requiring onsite operations in Singapore.',
      }),
    ],
  },
  {
    id: 'ux-product-designer',
    label: 'UX/product designer',
    applicationProfile: applicationProfile({
      id: 'profile-design',
      userId: 'eval-user-design',
      fullName: 'Synthetic Design Candidate',
      city: 'Copenhagen',
      country: 'Denmark',
      workAuthorization: 'EU work authorization',
      yearsExperience: 5,
    }),
    config: botConfig({
      id: 'config-design',
      userId: 'eval-user-design',
      keywords: ['Product Designer', 'UX Designer', 'UI UX Designer'],
      locations: ['Remote Europe', 'Copenhagen'],
      remoteOnly: false,
      experienceLevel: 'mid_level',
    }),
    resume: botResume({
      id: 'eval_resume_design',
      userId: 'eval-user-design',
      label: 'UX Product Design',
      matchKeywords: ['product designer', 'ux', 'figma'],
      structuredData: {
        name: 'Synthetic Design Candidate',
        email: 'design-candidate@example.invalid',
        location: 'Copenhagen, Denmark',
        summary: 'Product designer with UX research, Figma systems, prototyping, accessibility, and SaaS workflow design.',
        skills: ['Product design', 'UX research', 'Figma', 'Prototyping', 'Design systems', 'Accessibility'],
        languages: ['English'],
        experience: [{
          company: 'Synthetic Design Studio',
          title: 'Product Designer',
          startDate: '2021-01',
          endDate: 'Present',
          description: 'Designed complex SaaS workflows, research plans, prototypes, and component libraries.',
        }],
        education: [{ institution: 'Synthetic Design Academy', degree: 'BA', field: 'Interaction Design' }],
      },
      rawText: 'Product designer with UX research, Figma, prototyping, design systems, accessibility, and SaaS workflow design.',
    }),
    expectedSafeTerms: [
      'UX Product Designer',
      'UI UX Designer',
      'Design Systems Designer',
      'Product Designer',
      'UX Designer',
    ],
    jobs: [
      job({
        id: 'design-good',
        gold: 'good',
        title: 'Product Designer, B2B SaaS',
        company: 'Flowboard',
        location: 'Copenhagen, Denmark',
        description: 'Design complex SaaS workflows using UX research, Figma prototypes, accessibility, and design systems.',
      }),
      job({
        id: 'design-bad',
        gold: 'bad',
        title: 'Backend Payments Engineer',
        company: 'Ledger API',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Build payment processing services in Go, Kafka, and PostgreSQL.',
      }),
      job({
        id: 'design-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'UX Designer',
        company: 'Studio West',
        location: 'Los Angeles, CA, United States',
        description: 'Hybrid UX design role requiring three office days per week in Los Angeles.',
      }),
    ],
  },
  {
    id: 'entry-level-software',
    label: 'Entry-level software engineer',
    applicationProfile: applicationProfile({
      id: 'profile-entry',
      userId: 'eval-user-entry',
      fullName: 'Synthetic Entry Candidate',
      city: 'Porto',
      country: 'Portugal',
      workAuthorization: 'EU work authorization',
      yearsExperience: 1,
    }),
    config: botConfig({
      id: 'config-entry',
      userId: 'eval-user-entry',
      keywords: ['Junior Software Engineer', 'Entry Level Software Engineer', 'Graduate Developer'],
      locations: ['Remote Europe', 'Portugal', 'Porto'],
      remoteOnly: true,
      experienceLevel: 'entry',
      minScore: 65,
    }),
    resume: botResume({
      id: 'eval_resume_entry',
      userId: 'eval-user-entry',
      label: 'Entry Software Engineering',
      matchKeywords: ['junior software engineer', 'graduate developer', 'javascript'],
      structuredData: {
        name: 'Synthetic Entry Candidate',
        email: 'entry-candidate@example.invalid',
        location: 'Porto, Portugal',
        summary: 'Entry-level software engineer with JavaScript, TypeScript, React, Node.js, SQL, and internship project experience.',
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Git'],
        languages: ['English', 'Portuguese'],
        experience: [{
          company: 'Synthetic Internship Lab',
          title: 'Software Engineering Intern',
          startDate: '2025-02',
          endDate: '2025-08',
          description: 'Built small React features, Node.js endpoints, SQL reports, and automated tests with mentor review.',
        }],
        education: [{ institution: 'Synthetic Polytechnic', degree: 'BSc', field: 'Computer Science' }],
      },
      rawText: 'Entry-level software engineer with JavaScript, TypeScript, React, Node.js, SQL, Git, and internship projects.',
    }),
    expectedSafeTerms: ['Software Engineer', 'Junior Software Engineer'],
    jobs: [
      job({
        id: 'entry-good',
        gold: 'good',
        title: 'Junior Software Engineer',
        company: 'Starter Systems',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Entry-level role building JavaScript, TypeScript, React, Node.js, and SQL features with mentorship.',
      }),
      job({
        id: 'entry-bad',
        gold: 'bad',
        title: 'Principal Distributed Systems Engineer',
        company: 'Scale Grid',
        location: 'Remote Europe',
        isRemote: true,
        description: 'Lead architecture for distributed databases and mentor senior engineers; requires 12 years experience.',
      }),
      job({
        id: 'entry-hard-filter',
        gold: 'hard_filter',
        expectedFilterReason: 'wrong_location',
        title: 'Graduate Software Engineer',
        company: 'Campus Works',
        location: 'Melbourne, Australia',
        description: 'Graduate engineering role requiring onsite work in Melbourne.',
      }),
    ],
  },
]

export const BOT_EVAL_PERSONAS = BOT_EVAL_PERSONA_FIXTURES

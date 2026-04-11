"use server"

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const user = await requireAuth()

  const name = (formData.get('name') ?? '').toString().trim()
  const avatarUrl = (formData.get('avatarUrl') ?? '').toString().trim() || null

  await prisma.profile.upsert({
    where: { id: user.id },
    update: {
      name: name || null,
      avatarUrl,
    },
    create: {
      id: user.id,
      email: user.email ?? '',
      name: name || null,
      avatarUrl,
    },
  })

  revalidatePath('/profile')
}

export async function updateApplicationProfile(formData: FormData) {
  const user = await requireAuth()

  const str = (key: string) => (formData.get(key) ?? '').toString().trim() || null
  const num = (key: string) => {
    const v = parseInt((formData.get(key) ?? '').toString(), 10)
    return isNaN(v) ? null : v
  }
  const bool = (key: string) => formData.get(key) === 'true'

  await prisma.applicationProfile.upsert({
    where: { userId: user.id },
    update: {
      phone: str('phone'),
      address: str('address'),
      city: str('city'),
      state: str('state'),
      country: str('country') ?? 'United States',
      linkedinUrl: str('linkedinUrl'),
      githubUrl: str('githubUrl'),
      portfolioUrl: str('portfolioUrl'),
      workAuthorization: str('workAuthorization'),
      requiresSponsorship: bool('requiresSponsorship'),
      salaryExpectation: num('salaryExpectation'),
      noticePeriod: str('noticePeriod'),
      yearsExperience: num('yearsExperience'),
    },
    create: {
      userId: user.id,
      phone: str('phone'),
      address: str('address'),
      city: str('city'),
      state: str('state'),
      country: str('country') ?? 'United States',
      linkedinUrl: str('linkedinUrl'),
      githubUrl: str('githubUrl'),
      portfolioUrl: str('portfolioUrl'),
      workAuthorization: str('workAuthorization'),
      requiresSponsorship: bool('requiresSponsorship'),
      salaryExpectation: num('salaryExpectation'),
      noticePeriod: str('noticePeriod'),
      yearsExperience: num('yearsExperience'),
    },
  })

  revalidatePath('/profile')
}



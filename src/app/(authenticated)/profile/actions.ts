"use server"

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { cacheTagsFor } from '@/lib/cache-tags'

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

  const tags = cacheTagsFor(user.id)
  revalidateTag(tags.profile, { expire: 0 })
  revalidateTag(tags.profileMeta, { expire: 0 })
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

  const clearPortalPassword =
    formData.get('clearPortalSignupPassword') === 'on' ||
    formData.get('clearPortalSignupPassword') === 'true'
  const portalPwdRaw = (formData.get('portalSignupPassword') ?? '').toString().trim()
  const portalPasswordPatch = clearPortalPassword
    ? { portalSignupPassword: null as string | null }
    : portalPwdRaw
      ? { portalSignupPassword: portalPwdRaw }
      : {}

  const shared = {
    applicationFullName: str('applicationFullName'),
    applicationEmail: str('applicationEmail'),
    phone: str('phone'),
    address: str('address'),
    city: str('city'),
    state: str('state'),
    country: str('country'),
    linkedinUrl: str('linkedinUrl'),
    githubUrl: str('githubUrl'),
    portfolioUrl: str('portfolioUrl'),
    workAuthorization: str('workAuthorization'),
    requiresSponsorship: bool('requiresSponsorship'),
    salaryExpectation: num('salaryExpectation'),
    noticePeriod: str('noticePeriod'),
    yearsExperience: num('yearsExperience'),
  }

  await prisma.applicationProfile.upsert({
    where: { userId: user.id },
    update: {
      ...shared,
      ...portalPasswordPatch,
    },
    create: {
      userId: user.id,
      ...shared,
      portalSignupPassword: clearPortalPassword ? null : portalPwdRaw || null,
    },
  })

  const tags = cacheTagsFor(user.id)
  revalidateTag(tags.bot, { expire: 0 })
  revalidatePath('/profile')
  revalidatePath('/bot/identity')
}


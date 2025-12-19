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



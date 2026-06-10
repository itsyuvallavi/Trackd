import { revalidatePath, revalidateTag } from 'next/cache'
import { cacheTagsFor } from '@/lib/cache-tags'

export function revalidateBotRunViews(userId: string) {
  const tags = cacheTagsFor(userId)
  revalidateTag(tags.jobs, { expire: 0 })
  revalidateTag(tags.activity, { expire: 0 })
  revalidateTag(tags.notifications, { expire: 0 })
  revalidateTag(tags.bot, { expire: 0 })
  revalidatePath('/jobs')
  revalidatePath('/dashboard')
  revalidatePath('/today')
  revalidatePath('/board')
  revalidatePath('/bot/setup')
  revalidatePath('/bot/settings')
  revalidatePath('/bot')
  revalidatePath('/bot/runs')
}

import { redirect } from 'next/navigation'

export default function LegacyBotIdentityPage() {
  redirect('/bot/setup?section=profile')
}

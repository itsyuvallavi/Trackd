import { redirect } from 'next/navigation'

export default function LegacyBotSettingsPage() {
  redirect('/bot/setup?section=search')
}

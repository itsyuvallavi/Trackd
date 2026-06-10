import { redirect } from 'next/navigation'

export default function LegacyBotResumesPage() {
  redirect('/bot/setup?section=resume')
}

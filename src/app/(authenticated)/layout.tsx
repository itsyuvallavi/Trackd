import { PageTransition } from '@/components/layout/page-transition'
import { BottomTabBar } from '@/components/layout/bottom-tab-bar'

// Simplified layout - data fetching moved to individual pages to leverage
// Next.js page-level caching and avoid extra database connections on every navigation
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PageTransition>{children}</PageTransition>
      <BottomTabBar />
    </>
  )
}

import { PageTransition } from '@/components/layout/page-transition'
import { BottomTabBar } from '@/components/layout/bottom-tab-bar'

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

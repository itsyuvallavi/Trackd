import { HeaderSkeleton } from './header-skeleton'
import { TableSkeleton } from './table-skeleton'

export function LoadingState() {
  return (
    <div className="px-8 py-6">
      <HeaderSkeleton />
      <div className="mt-6">
        <TableSkeleton />
      </div>
    </div>
  )
}

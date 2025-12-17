import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Job Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The job you're looking for doesn't exist or may have been deleted.
        </p>
        <Link href="/jobs">
          <Button>
            <ArrowLeft className="size-4 mr-2" />
            Back to Jobs
          </Button>
        </Link>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export function HeroImage() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-muted animate-pulse" />
    )
  }

  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <Image
        src="https://images.unsplash.com/photo-1686984096026-23d6e82f9749?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqb2IlMjBzZWFyY2glMjB3b3Jrc3BhY2UlMjBkZXNrfGVufDF8fHx8MTc2NTg1MDEzN3ww&ixlib=rb-4.1.0&q=80&w=1080"
        alt="Workspace"
        className="object-cover object-bottom"
        fill
        priority
        sizes="50vw"
        quality={85}
      />
    </div>
  )
}

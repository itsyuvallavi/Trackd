'use client'

import { motion, type Variants } from 'framer-motion'
import { usePathname } from 'next/navigation'

// Optimized page transition - no exit animation blocking
// New content appears immediately for faster perceived navigation
const pageVariants: Variants = {
  initial: { opacity: 0 },
  enter: { 
    opacity: 1, 
    transition: {
      duration: 0.15,
      ease: 'easeOut' as const,
    }
  },
}

interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  
  // Using simple fade-in without AnimatePresence mode="wait"
  // This allows new content to appear immediately without waiting for exit animation
  return (
    <motion.div
      key={pathname}
      initial="initial"
      animate="enter"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  )
}


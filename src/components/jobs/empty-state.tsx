'use client'

import { motion } from 'framer-motion'
import { Briefcase, Link as LinkIcon, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onManualAdd: () => void
  onUrlAdd: () => void
}

export function EmptyState({ onManualAdd, onUrlAdd }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center max-w-md px-6"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6"
        >
          <Briefcase className="size-10 text-primary" strokeWidth={1.5} />
        </motion.div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Start tracking your applications
        </h2>

        {/* Description */}
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Keep all your job applications organized in one place. Track status, set reminders,
          and never miss a follow-up opportunity.
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* From URL Card */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onUrlAdd}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <LinkIcon className="size-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">From URL</div>
              <div className="text-sm text-muted-foreground">
                Paste a job link to auto-fill details
              </div>
            </div>
          </motion.button>

          {/* Manual Entry Card */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onManualAdd}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Edit3 className="size-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Manual Entry</div>
              <div className="text-sm text-muted-foreground">
                Enter job details manually
              </div>
            </div>
          </motion.button>
        </div>

        {/* Additional Help Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xs text-muted-foreground"
        >
          You can also use our Chrome extension to save jobs while browsing
        </motion.p>
      </motion.div>
    </div>
  )
}

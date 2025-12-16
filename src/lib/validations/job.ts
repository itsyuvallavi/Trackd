import { z } from 'zod'
import { JobStatus, JobPriority, JobSource } from '@prisma/client'

export const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company is required'),
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  location: z.string().optional(),
  source: z.nativeEnum(JobSource).default('MANUAL'),
  status: z.nativeEnum(JobStatus).default('SAVED'),
  priority: z.nativeEnum(JobPriority).default('B'),
  notes: z.string().optional(),
  salary: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  nextAction: z.string().optional(),
})

export const updateJobSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  company: z.string().min(1, 'Company is required').optional(),
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  location: z.string().optional(),
  source: z.nativeEnum(JobSource).optional(),
  status: z.nativeEnum(JobStatus).optional(),
  priority: z.nativeEnum(JobPriority).optional(),
  notes: z.string().optional(),
  salary: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  nextAction: z.string().optional(),
  appliedAt: z.date().optional(),
  interviewAt: z.date().optional(),
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>

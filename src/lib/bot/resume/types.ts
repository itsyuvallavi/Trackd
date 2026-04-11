export interface ResumeStructuredData {
  name: string
  email: string
  phone?: string
  location?: string
  linkedin?: string
  github?: string
  portfolio?: string
  summary?: string
  skills: string[]
  languages?: string[]
  experience: Array<{
    company: string
    title: string
    startDate: string
    endDate: string     // "Present" or date
    description: string
    achievements?: string[]
  }>
  education: Array<{
    institution: string
    degree: string
    field?: string
    startDate?: string
    endDate?: string
    gpa?: string
  }>
  certifications?: string[]
}

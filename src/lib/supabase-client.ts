import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://myxbtnqaruddbwmxoijs.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15eGJ0bnFhcnVkZGJ3bXhvaWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDA1ODEsImV4cCI6MjA4MTQxNjU4MX0.ATzcfAdA8pi4CvXp8nvqlxkeUor3ksLYK3xCN6UnxSc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


-- Run once in Supabase SQL Editor after renaming migration folders in git.
-- Fix 1: DB recorded the duplicate ghosted migration (wrong timestamp → runs before init in shadow replay).
UPDATE "_prisma_migrations"
SET migration_name = '20251214092212_change_ghosted_to_archived'
WHERE migration_name = '20250103150000_change_ghosted_to_archived';

-- Fix 2: accidental shell literal as migration name (exact string in Postgres).
UPDATE "_prisma_migrations"
SET migration_name = '20260105131130_add_resume_file_storage'
WHERE migration_name = '$(date +%Y%m%d%H%M%S)_add_resume_file_storage';

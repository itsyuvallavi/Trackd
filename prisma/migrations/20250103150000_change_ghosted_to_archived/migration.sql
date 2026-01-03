-- AlterEnum
-- This migration updates the JobStatus enum from GHOSTED to ARCHIVED
DO $$ 
BEGIN
  -- Check if GHOSTED exists and rename it to ARCHIVED
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'GHOSTED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'JobStatus')
  ) THEN
    ALTER TYPE "JobStatus" RENAME VALUE 'GHOSTED' TO 'ARCHIVED';
  END IF;
END $$;

-- Update any existing records that might still have GHOSTED status
UPDATE "Job" 
SET status = 'ARCHIVED'::"JobStatus" 
WHERE status::text = 'GHOSTED';


-- AlterTable
ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "resumeFileUrl" TEXT,
ADD COLUMN IF NOT EXISTS "resumeFileName" TEXT,
ADD COLUMN IF NOT EXISTS "resumeFileType" TEXT,
ADD COLUMN IF NOT EXISTS "openaiFileId" TEXT,
ADD COLUMN IF NOT EXISTS "openaiAssistantId" TEXT,
ADD COLUMN IF NOT EXISTS "openaiThreadId" TEXT;

-- Make resumeText optional (nullable)
ALTER TABLE "ResumeSession" ALTER COLUMN "resumeText" DROP NOT NULL;


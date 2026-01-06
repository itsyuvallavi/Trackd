-- Create ResumeSession table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ResumeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeFileUrl" TEXT NOT NULL,
    "resumeFileName" TEXT NOT NULL,
    "resumeFileType" TEXT NOT NULL,
    "resumeText" TEXT,
    "improvedResumeText" TEXT,
    "openaiFileId" TEXT,
    "openaiAssistantId" TEXT,
    "openaiThreadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeSession_pkey" PRIMARY KEY ("id")
);

-- Create ResumeMessage table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ResumeMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeMessage_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "ResumeSession_userId_createdAt_idx" ON "ResumeSession"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ResumeMessage_sessionId_timestamp_idx" ON "ResumeMessage"("sessionId", "timestamp");

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ResumeMessage_sessionId_fkey'
        AND table_name = 'ResumeMessage'
    ) THEN
        ALTER TABLE "ResumeMessage" ADD CONSTRAINT "ResumeMessage_sessionId_fkey" 
        FOREIGN KEY ("sessionId") REFERENCES "ResumeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- If ResumeSession already exists, add new columns
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ResumeSession') THEN
        ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "resumeFileUrl" TEXT;
        ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "resumeFileName" TEXT;
        ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "resumeFileType" TEXT;
        ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "openaiFileId" TEXT;
        ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "openaiAssistantId" TEXT;
        ALTER TABLE "ResumeSession" ADD COLUMN IF NOT EXISTS "openaiThreadId" TEXT;
        
        -- Make resumeText nullable if it exists and is not nullable
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ResumeSession' 
            AND column_name = 'resumeText' 
            AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE "ResumeSession" ALTER COLUMN "resumeText" DROP NOT NULL;
        END IF;
    END IF;
END $$;

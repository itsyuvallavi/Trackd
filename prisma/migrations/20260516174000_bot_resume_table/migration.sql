-- BotResume existed in the Prisma schema before it was represented in migration history.
-- Keep this migration idempotent so it is safe for databases that already received the
-- table through `prisma db push` or a manual production change.

CREATE TABLE IF NOT EXISTS "BotResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rawText" TEXT,
    "structuredData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotResume_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BotResume_userId_idx" ON "BotResume"("userId");

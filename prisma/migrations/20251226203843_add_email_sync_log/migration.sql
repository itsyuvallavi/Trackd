-- CreateTable
CREATE TABLE "EmailSyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "totalEmails" INTEGER NOT NULL DEFAULT 0,
    "processedEmails" INTEGER NOT NULL DEFAULT 0,
    "skippedEmails" INTEGER NOT NULL DEFAULT 0,
    "skippedOther" INTEGER NOT NULL DEFAULT 0,
    "skippedLowConfidence" INTEGER NOT NULL DEFAULT 0,
    "exactMatches" INTEGER NOT NULL DEFAULT 0,
    "fuzzyMatches" INTEGER NOT NULL DEFAULT 0,
    "ambiguousMatches" INTEGER NOT NULL DEFAULT 0,
    "newJobsDetected" INTEGER NOT NULL DEFAULT 0,
    "noMatches" INTEGER NOT NULL DEFAULT 0,
    "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSyncLog_userId_createdAt_idx" ON "EmailSyncLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSyncLog_userId_success_idx" ON "EmailSyncLog"("userId", "success");

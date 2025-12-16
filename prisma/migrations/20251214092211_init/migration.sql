-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('MANUAL', 'LINKEDIN', 'INDEED', 'COMPANY_SITE', 'REFERRAL', 'RECRUITER', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'STATUS_CHANGE', 'EMAIL_UPDATE', 'INTERVIEW', 'REJECTION', 'OFFER');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'temp-user',
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "source" "JobSource" NOT NULL DEFAULT 'MANUAL',
    "url" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'SAVED',
    "priority" "JobPriority" NOT NULL DEFAULT 'B',
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "interviewAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "salary" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'temp-user',
    "type" "ActivityType" NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus",
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_userId_status_idx" ON "Job"("userId", "status");

-- CreateIndex
CREATE INDEX "Job_userId_savedAt_idx" ON "Job"("userId", "savedAt");

-- CreateIndex
CREATE INDEX "Activity_jobId_createdAt_idx" ON "Activity"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

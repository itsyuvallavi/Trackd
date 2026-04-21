-- Bot tables were created in production via `db push` before they appeared in the migration history.
-- This migration backfills them for fresh DBs and for `prisma migrate dev` shadow replays.
-- BotRunLog / BotRunListing DDL lives here (not only in later migrations) because Prisma’s shadow
-- validation (P1014) does not treat `BotRun` as existing for hand-written SQL in a *later* migration file.
-- `IF NOT EXISTS` keeps `migrate deploy` safe when objects already exist.

DO $$ BEGIN
    CREATE TYPE "BotSearchFrequency" AS ENUM ('DAILY', 'TWICE_DAILY', 'WEEKLY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "BotRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BotConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spokenLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "remoteOnly" BOOLEAN NOT NULL DEFAULT false,
    "experienceLevel" TEXT,
    "salaryMin" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "searchFrequency" "BotSearchFrequency" NOT NULL DEFAULT 'DAILY',
    "lastSearchAt" TIMESTAMP(3),
    "telegramChatId" TEXT,
    "minScore" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BotConfig_userId_key" ON "BotConfig"("userId");
CREATE INDEX IF NOT EXISTS "BotConfig_userId_idx" ON "BotConfig"("userId");
CREATE INDEX IF NOT EXISTS "BotConfig_isActive_idx" ON "BotConfig"("isActive");

CREATE TABLE IF NOT EXISTS "BotRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botConfigId" TEXT NOT NULL,
    "status" "BotRunStatus" NOT NULL DEFAULT 'RUNNING',
    "source" TEXT NOT NULL DEFAULT 'cron',
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsNew" INTEGER NOT NULL DEFAULT 0,
    "jobsEvaluated" INTEGER NOT NULL DEFAULT 0,
    "jobsApproved" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "errors" JSONB,
    "searchMeta" JSONB,

    CONSTRAINT "BotRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BotRun_userId_startedAt_idx" ON "BotRun"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "BotRun_botConfigId_startedAt_idx" ON "BotRun"("botConfigId", "startedAt");

DO $$ BEGIN
    ALTER TABLE "BotRun" ADD CONSTRAINT "BotRun_botConfigId_fkey"
    FOREIGN KEY ("botConfigId") REFERENCES "BotConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ApplicationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationFullName" TEXT,
    "applicationEmail" TEXT,
    "portalSignupPassword" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "workAuthorization" TEXT,
    "requiresSponsorship" BOOLEAN NOT NULL DEFAULT false,
    "salaryExpectation" INTEGER,
    "noticePeriod" TEXT,
    "yearsExperience" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationProfile_userId_key" ON "ApplicationProfile"("userId");

-- --- inlined from `20260420120000_bot_run_log` / `20260420160000_bot_run_listing_audit` (see header) ---

CREATE TABLE IF NOT EXISTS "BotRunLog" (
    "id" TEXT NOT NULL,
    "botRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotRunLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BotRunLog_botRunId_sequence_idx" ON "BotRunLog"("botRunId", "sequence");

DO $$ BEGIN
    ALTER TABLE "BotRunLog" ADD CONSTRAINT "BotRunLog_botRunId_fkey"
    FOREIGN KEY ("botRunId") REFERENCES "BotRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BotRunListing" (
    "id" TEXT NOT NULL,
    "botRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "importSource" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT,
    "jobSnapshot" JSONB NOT NULL,
    "minScoreAtRun" INTEGER NOT NULL,
    "evaluated" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "shouldApply" BOOLEAN,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasoning" TEXT,
    "resumeMatch" TEXT,
    "scoringInputs" JSONB,
    "decisionReason" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotRunListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BotRunListing_botRunId_sequence_key" ON "BotRunListing"("botRunId", "sequence");
CREATE INDEX IF NOT EXISTS "BotRunListing_botRunId_outcome_idx" ON "BotRunListing"("botRunId", "outcome");
CREATE INDEX IF NOT EXISTS "BotRunListing_botRunId_stage_idx" ON "BotRunListing"("botRunId", "stage");

DO $$ BEGIN
    ALTER TABLE "BotRunListing" ADD CONSTRAINT "BotRunListing_botRunId_fkey"
    FOREIGN KEY ("botRunId") REFERENCES "BotRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

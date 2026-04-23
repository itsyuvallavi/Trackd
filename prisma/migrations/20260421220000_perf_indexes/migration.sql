-- Performance indexes added as part of the "perf pass balanced" sweep.
-- Speeds up:
--   - Calendar / Today interview windowing (Job.interviewAt filtered by userId)
--   - "Recently applied" queries (Job.appliedAt filtered by userId)
--   - Ambiguous-notification fallbacks and type-scoped feeds
--     (Notification.type date-ordered per user)

-- CreateIndex
CREATE INDEX "Job_userId_interviewAt_idx" ON "Job"("userId", "interviewAt");

-- CreateIndex
CREATE INDEX "Job_userId_appliedAt_idx" ON "Job"("userId", "appliedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");

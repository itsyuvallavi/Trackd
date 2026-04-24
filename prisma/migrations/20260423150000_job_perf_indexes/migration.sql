-- GIN for `tags: { has: '…' }` bot-queue style queries; composite for board-style sorts.
CREATE INDEX IF NOT EXISTS "Job_userId_status_updatedAt_idx" ON "Job" ("userId", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Job_tags_idx" ON "Job" USING GIN ("tags");

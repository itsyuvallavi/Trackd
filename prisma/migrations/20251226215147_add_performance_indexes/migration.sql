-- CreateIndex
CREATE INDEX "Activity_userId_type_createdAt_idx" ON "Activity"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "EmailIntegration_userId_isActive_idx" ON "EmailIntegration"("userId", "isActive");

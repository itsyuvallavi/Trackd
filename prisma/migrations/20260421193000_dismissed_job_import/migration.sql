-- CreateTable
CREATE TABLE "DismissedJobImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismissedJobImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DismissedJobImport_userId_fingerprint_key" ON "DismissedJobImport"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "DismissedJobImport_userId_idx" ON "DismissedJobImport"("userId");

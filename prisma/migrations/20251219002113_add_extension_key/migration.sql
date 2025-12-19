-- CreateTable
CREATE TABLE "ExtensionKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ExtensionKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionKey_userId_key" ON "ExtensionKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionKey_keyHash_key" ON "ExtensionKey"("keyHash");

-- CreateIndex
CREATE INDEX "ExtensionKey_keyHash_idx" ON "ExtensionKey"("keyHash");

-- CreateIndex
CREATE INDEX "ExtensionKey_userId_idx" ON "ExtensionKey"("userId");

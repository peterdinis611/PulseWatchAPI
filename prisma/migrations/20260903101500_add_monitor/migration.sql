-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalSec" INTEGER NOT NULL DEFAULT 60,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "config" TEXT NOT NULL,
    "lastStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastError" TEXT,
    "lastLatencyMs" INTEGER,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Monitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Monitor_userId_createdAt_idx" ON "Monitor"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Monitor_enabled_lastCheckedAt_idx" ON "Monitor"("enabled", "lastCheckedAt");

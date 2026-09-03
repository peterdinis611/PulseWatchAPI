-- CreateTable
CREATE TABLE "StressTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "vus" INTEGER NOT NULL DEFAULT 10,
    "durationSec" INTEGER NOT NULL DEFAULT 30,
    "expectedStatus" INTEGER NOT NULL DEFAULT 200,
    "p95Ms" INTEGER,
    "maxFailRate" REAL,
    "lastStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "lastError" TEXT,
    "lastSummary" TEXT,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StressTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StressTestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stressTestId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "summary" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "StressTestRun_stressTestId_fkey" FOREIGN KEY ("stressTestId") REFERENCES "StressTest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StressTest_userId_createdAt_idx" ON "StressTest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StressTestRun_stressTestId_startedAt_idx" ON "StressTestRun"("stressTestId", "startedAt");

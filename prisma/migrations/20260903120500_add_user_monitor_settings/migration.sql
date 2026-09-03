-- CreateTable
CREATE TABLE "UserMonitorSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "defaultIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "defaultTimeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "notifyOnDown" BOOLEAN NOT NULL DEFAULT 1,
    "notifyOnRecover" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserMonitorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

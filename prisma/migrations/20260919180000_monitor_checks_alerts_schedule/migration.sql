-- AlterTable Notification: deep links
ALTER TABLE "Notification" ADD COLUMN "monitorId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "stressTestId" TEXT;

-- AlterTable UserMonitorSettings: external alerts + fleet maintenance
ALTER TABLE "UserMonitorSettings" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "UserMonitorSettings" ADD COLUMN "slackWebhookUrl" TEXT;
ALTER TABLE "UserMonitorSettings" ADD COLUMN "alertEmail" TEXT;
ALTER TABLE "UserMonitorSettings" ADD COLUMN "fleetAlertsMuted" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "UserMonitorSettings" ADD COLUMN "maintenanceUntil" DATETIME;

-- AlterTable Monitor: per-monitor mute + alert dedup timestamps
ALTER TABLE "Monitor" ADD COLUMN "alertsMuted" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Monitor" ADD COLUMN "lastDownNotifiedAt" DATETIME;
ALTER TABLE "Monitor" ADD COLUMN "lastRecoverNotifiedAt" DATETIME;

-- CreateTable MonitorCheck
CREATE TABLE "MonitorCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitorCheck_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MonitorCheck_monitorId_checkedAt_idx" ON "MonitorCheck"("monitorId", "checkedAt");

-- AlterTable StressTest: scheduled k6 runs
ALTER TABLE "StressTest" ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "StressTest" ADD COLUMN "scheduleIntervalSec" INTEGER;
ALTER TABLE "StressTest" ADD COLUMN "scheduleLastRunAt" DATETIME;

CREATE INDEX "StressTest_scheduleEnabled_scheduleLastRunAt_idx" ON "StressTest"("scheduleEnabled", "scheduleLastRunAt");

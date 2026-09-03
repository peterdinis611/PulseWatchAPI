export function isStressTestDue(test: {
  scheduleEnabled: boolean;
  scheduleIntervalSec: number | null;
  scheduleLastRunAt: Date | null;
}): boolean {
  if (!test.scheduleEnabled || !test.scheduleIntervalSec) {
    return false;
  }

  if (!test.scheduleLastRunAt) {
    return true;
  }

  const elapsedMs = Date.now() - test.scheduleLastRunAt.getTime();
  return elapsedMs >= test.scheduleIntervalSec * 1000;
}

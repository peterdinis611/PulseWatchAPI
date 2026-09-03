export function createTestJobsService() {
  return {
    isEnabled: jest.fn().mockReturnValue(false),
    scheduleMonitorCheck: jest.fn().mockResolvedValue(undefined),
    unscheduleMonitorCheck: jest.fn().mockResolvedValue(undefined),
    enqueueStressTestRun: jest.fn().mockResolvedValue(false),
  };
}

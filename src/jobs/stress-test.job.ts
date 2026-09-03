export const STRESS_TEST_QUEUE = 'stress-tests';
export const STRESS_TEST_JOB = 'run';
export const STRESS_TEST_SCHEDULE_JOB = 'scheduled-run';

export type StressTestRunJobData = {
  runId: string;
};

export type StressTestScheduleJobData = {
  stressTestId: string;
};

export type StressTestJobData =
  | StressTestRunJobData
  | StressTestScheduleJobData;

export function stressTestSchedulerId(stressTestId: string): string {
  return `stress:${stressTestId}`;
}

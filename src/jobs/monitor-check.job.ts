export const MONITOR_CHECK_QUEUE = 'monitor-checks';
export const MONITOR_CHECK_JOB = 'check';

export type MonitorCheckJobData = {
  monitorId: string;
};

export function monitorCheckSchedulerId(monitorId: string): string {
  return `monitor:${monitorId}`;
}

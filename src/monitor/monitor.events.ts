export const MONITOR_UPDATED = 'monitorUpdated';

export function monitorUpdatedTrigger(userId: string): string {
  return `${MONITOR_UPDATED}.${userId}`;
}

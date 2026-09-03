export const NOTIFICATION_RECEIVED = 'notificationReceived';

export function notificationReceivedTrigger(userId: string): string {
  return `${NOTIFICATION_RECEIVED}.${userId}`;
}

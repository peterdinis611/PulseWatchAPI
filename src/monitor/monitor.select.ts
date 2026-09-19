export const monitorSelect = {
  id: true,
  userId: true,
  name: true,
  type: true,
  enabled: true,
  intervalSec: true,
  timeoutMs: true,
  config: true,
  lastStatus: true,
  lastError: true,
  lastLatencyMs: true,
  lastCheckedAt: true,
  alertsMuted: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const monitorAlertSelect = {
  ...monitorSelect,
  lastDownNotifiedAt: true,
  lastRecoverNotifiedAt: true,
} as const;

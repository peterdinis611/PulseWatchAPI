export type MonitorConfigValue = {
  url?: string;
  method?: string;
  expectedStatus?: number;
  host?: string;
  port?: number;
};

export function parseMonitorConfig(raw: string): MonitorConfigValue {
  try {
    const parsed = JSON.parse(raw) as MonitorConfigValue;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function serializeMonitorConfig(config: MonitorConfigValue): string {
  return JSON.stringify(config);
}

export function isMonitorDue(
  monitor: { lastCheckedAt: Date | null; intervalSec: number },
  now = Date.now(),
): boolean {
  if (!monitor.lastCheckedAt) {
    return true;
  }
  return monitor.lastCheckedAt.getTime() + monitor.intervalSec * 1000 <= now;
}

export function clipError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

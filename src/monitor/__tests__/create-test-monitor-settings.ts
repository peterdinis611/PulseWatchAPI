import { DEFAULT_INTERVAL_SEC, DEFAULT_TIMEOUT_MS } from '../monitor.constants';
import type { MonitorSettingsView } from '../monitor-settings.service';

export function createTestMonitorSettings(
  overrides: Partial<MonitorSettingsView> = {},
): MonitorSettingsView {
  return {
    defaultIntervalSec: DEFAULT_INTERVAL_SEC,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    notifyOnDown: true,
    notifyOnRecover: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function createTestMonitorSettingsService(
  overrides: Partial<MonitorSettingsView> = {},
) {
  return {
    getForUser: jest
      .fn()
      .mockResolvedValue(createTestMonitorSettings(overrides)),
    updateForUser: jest
      .fn()
      .mockResolvedValue(createTestMonitorSettings(overrides)),
  };
}

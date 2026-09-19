import { parseMonitorConfig } from './monitor-config';
import { MonitorStatus } from './monitor-status';
import { MonitorType } from './monitor-type';
import type { MonitorView } from './monitor.service';

export function mapMonitorRow(monitor: {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  alertsMuted: boolean;
  intervalSec: number;
  timeoutMs: number;
  config: string;
  lastStatus: string;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MonitorView {
  return {
    id: monitor.id,
    name: monitor.name,
    type: monitor.type as MonitorType,
    enabled: monitor.enabled,
    alertsMuted: monitor.alertsMuted,
    intervalSec: monitor.intervalSec,
    timeoutMs: monitor.timeoutMs,
    config: parseMonitorConfig(monitor.config),
    lastStatus: monitor.lastStatus as MonitorStatus,
    lastError: monitor.lastError,
    lastLatencyMs: monitor.lastLatencyMs,
    lastCheckedAt: monitor.lastCheckedAt,
    createdAt: monitor.createdAt,
    updatedAt: monitor.updatedAt,
  };
}

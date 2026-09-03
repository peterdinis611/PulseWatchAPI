export type MonitorConfigValue = {
  url?: string;
  method?: string;
  expectedStatus?: number;
  host?: string;
  port?: number;
  serverName?: string;
  minDaysUntilExpiry?: number;
  allowUnauthorized?: boolean;
  recordType?: string;
  expectedValue?: string;
  nameserver?: string;
  secure?: boolean;
  startTls?: boolean;
  tls?: boolean;
  topic?: string;
  service?: string;
};

export function parseMonitorConfig(raw: string): MonitorConfigValue {
  try {
    const parsed = JSON.parse(raw) as MonitorConfigValue;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
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

export function clipError(message: string): string {
  return message.slice(0, 500);
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(
      /([a-z][a-z0-9+.-]*):\/\/([^/@\s]+):([^/@\s]+)@/gi,
      '$1://***:***@',
    )
    .replace(/(password|pwd|secret)=([^&\s]+)/gi, '$1=***');
}

export function formatProbeError(error: unknown): string {
  const mapped = mapKnownError(error) ?? mapKnownError(errorCause(error));
  if (mapped) {
    return mapped;
  }

  const raw = error instanceof Error ? error.message : String(error);
  if (/fetch failed/i.test(raw) || /failed to fetch/i.test(raw)) {
    return 'Request failed';
  }

  return clipError(sanitizeErrorMessage(raw || 'Check failed'));
}

function errorCause(error: unknown): unknown {
  if (typeof error === 'object' && error && 'cause' in error) {
    return (error as { cause: unknown }).cause;
  }
  return undefined;
}

function mapKnownError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const code =
    'code' in error && error.code != null ? String(error.code) : undefined;
  const name = error instanceof Error ? error.name : undefined;

  if (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return 'Request timed out';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Host could not be resolved';
  }
  if (code === 'ENODATA' || code === 'ETIME') {
    return 'DNS record was not found';
  }
  if (code === 'ECONNREFUSED') {
    return 'Connection refused';
  }
  if (code === 'ECONNRESET') {
    return 'Connection reset';
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return 'Host unreachable';
  }
  if (
    code === 'CERT_HAS_EXPIRED' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID'
  ) {
    return 'TLS certificate error';
  }

  return undefined;
}

export function clampTimeoutMs(timeoutMs: number, fallback: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fallback;
  }
  return Math.min(30_000, Math.max(1_000, Math.trunc(timeoutMs)));
}

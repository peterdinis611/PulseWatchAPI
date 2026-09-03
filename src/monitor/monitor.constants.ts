export const DEFAULT_INTERVAL_SEC = 60;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const MIN_INTERVAL_SEC = 10;
export const MAX_INTERVAL_SEC = 3_600;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 30_000;
export const MAX_ERROR_LENGTH = 500;
export const MAX_MONITOR_NAME_LENGTH = 120;
export const MAX_URL_LENGTH = 2048;
export const MONITOR_USER_AGENT = 'PulseWatch/0.0.1';
export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export const DEFAULT_STRESS_TEST_VUS = 10;
export const DEFAULT_STRESS_TEST_DURATION_SEC = 30;
export const DEFAULT_EXPECTED_STATUS = 200;
export const MIN_VUS = 1;
export const MAX_VUS = 50;
export const MIN_DURATION_SEC = 5;
export const MAX_DURATION_SEC = 120;
export const MIN_P95_MS = 1;
export const MAX_P95_MS = 60_000;
export const MIN_FAIL_RATE = 0;
export const MAX_FAIL_RATE = 1;
export const MAX_STRESS_TEST_NAME_LENGTH = 120;
export const MAX_URL_LENGTH = 2048;
export const MAX_ERROR_LENGTH = 500;
export const K6_GRACE_MS = 15_000;
export const DEFAULT_K6_BIN = 'k6';
export const K6_INSTALL_URL = 'https://k6.io';
export const STRESS_TEST_USER_AGENT = 'PulseWatch-k6/0.0.1';
export const STRESS_TEST_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

export type StressTestMethod = (typeof STRESS_TEST_METHODS)[number];

export function k6TimeoutMs(durationSec: number): number {
  return durationSec * 1000 + K6_GRACE_MS;
}

export function clipError(message: string): string {
  return message.slice(0, MAX_ERROR_LENGTH);
}

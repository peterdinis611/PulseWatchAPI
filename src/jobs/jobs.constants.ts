export const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';
export const JOBS_REDIS_PREFIX = 'pulsewatch';
export const DEFAULT_JOBS_CONCURRENCY = 5;
export const MAX_JOBS_CONCURRENCY = 50;

export function jobConcurrency(): number {
  const parsed = Number(process.env.JOBS_CONCURRENCY);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_JOBS_CONCURRENCY;
  }

  return Math.min(Math.trunc(parsed), MAX_JOBS_CONCURRENCY);
}

import { config as loadEnv } from 'dotenv';

loadEnv();

export function areJobsEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  const flag = process.env.JOBS_ENABLED;
  if (flag === 'false' || flag === '0') {
    return false;
  }
  if (flag === 'true' || flag === '1') {
    return true;
  }

  return Boolean(process.env.REDIS_URL);
}

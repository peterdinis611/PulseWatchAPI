import { areJobsEnabled } from '../are-jobs-enabled';

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe('areJobsEnabled', () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    JOBS_ENABLED: process.env.JOBS_ENABLED,
    REDIS_URL: process.env.REDIS_URL,
  };

  afterEach(() => {
    restoreEnv('NODE_ENV', original.NODE_ENV);
    restoreEnv('JOBS_ENABLED', original.JOBS_ENABLED);
    restoreEnv('REDIS_URL', original.REDIS_URL);
  });

  it('is disabled during tests', () => {
    process.env.NODE_ENV = 'test';
    process.env.JOBS_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    expect(areJobsEnabled()).toBe(false);
  });

  it('is disabled when JOBS_ENABLED is false', () => {
    process.env.NODE_ENV = 'development';
    process.env.JOBS_ENABLED = 'false';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';

    expect(areJobsEnabled()).toBe(false);
  });

  it('is enabled when JOBS_ENABLED is true', () => {
    process.env.NODE_ENV = 'development';
    process.env.JOBS_ENABLED = 'true';
    delete process.env.REDIS_URL;

    expect(areJobsEnabled()).toBe(true);
  });

  it('follows REDIS_URL when JOBS_ENABLED is unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JOBS_ENABLED;
    delete process.env.REDIS_URL;
    expect(areJobsEnabled()).toBe(false);

    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    expect(areJobsEnabled()).toBe(true);
  });
});

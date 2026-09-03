import { jobConcurrency } from '../jobs.constants';

describe('jobConcurrency', () => {
  const original = process.env.JOBS_CONCURRENCY;

  afterEach(() => {
    process.env.JOBS_CONCURRENCY = original;
  });

  it('defaults to 5', () => {
    delete process.env.JOBS_CONCURRENCY;
    expect(jobConcurrency()).toBe(5);
  });

  it('caps at 50', () => {
    process.env.JOBS_CONCURRENCY = '999';
    expect(jobConcurrency()).toBe(50);
  });
});

import { LoggerService } from '../../logger/logger.service';
import { JobsService } from '../jobs.service';
import {
  MONITOR_CHECK_JOB,
  monitorCheckSchedulerId,
} from '../monitor-check.job';
import { STRESS_TEST_JOB } from '../stress-test.job';

describe('JobsService', () => {
  const queue = {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    removeJobScheduler: jest.fn().mockResolvedValue(true),
  };
  const stressQueue = {
    add: jest.fn().mockResolvedValue({ id: 'run-1' }),
  };
  const logger = { debug: jest.fn() } as unknown as LoggerService;

  beforeEach(() => {
    queue.upsertJobScheduler.mockClear();
    queue.removeJobScheduler.mockClear();
    stressQueue.add.mockClear();
  });

  it('is disabled without a queue', () => {
    const jobs = new JobsService(null, null, logger);
    expect(jobs.isEnabled()).toBe(false);
  });

  it('upserts a repeatable monitor check', async () => {
    const jobs = new JobsService(queue, stressQueue, logger);

    await jobs.scheduleMonitorCheck('m-1', 60);

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      monitorCheckSchedulerId('m-1'),
      { every: 60_000 },
      {
        name: MONITOR_CHECK_JOB,
        data: { monitorId: 'm-1' },
      },
    );
  });

  it('removes a monitor check scheduler', async () => {
    const jobs = new JobsService(queue, stressQueue, logger);

    await jobs.unscheduleMonitorCheck('m-1');

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(
      monitorCheckSchedulerId('m-1'),
    );
  });

  it('no-ops schedule and unschedule without a queue', async () => {
    const jobs = new JobsService(null, null, logger);

    await expect(jobs.scheduleMonitorCheck('m-1', 60)).resolves.toBeUndefined();
    await expect(jobs.unscheduleMonitorCheck('m-1')).resolves.toBeUndefined();
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
  });

  it('enqueues a stress test run', async () => {
    const jobs = new JobsService(queue, stressQueue, logger);

    await expect(jobs.enqueueStressTestRun('run-1')).resolves.toBe(true);
    expect(stressQueue.add).toHaveBeenCalledWith(
      STRESS_TEST_JOB,
      { runId: 'run-1' },
      { jobId: 'run-1' },
    );
  });

  it('returns false when the stress-test queue is missing', async () => {
    const jobs = new JobsService(queue, null, logger);

    await expect(jobs.enqueueStressTestRun('run-1')).resolves.toBe(false);
    expect(stressQueue.add).not.toHaveBeenCalled();
  });
});

import { LoggerService } from '../../logger/logger.service';
import { JobsService } from '../jobs.service';
import {
  MONITOR_CHECK_JOB,
  monitorCheckSchedulerId,
} from '../monitor-check.job';

describe('JobsService', () => {
  const queue = {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    removeJobScheduler: jest.fn().mockResolvedValue(true),
  };
  const logger = { debug: jest.fn() } as unknown as LoggerService;

  beforeEach(() => {
    queue.upsertJobScheduler.mockClear();
    queue.removeJobScheduler.mockClear();
  });

  it('is disabled without a queue', () => {
    const jobs = new JobsService(null, logger);
    expect(jobs.isEnabled()).toBe(false);
  });

  it('upserts a repeatable monitor check', async () => {
    const jobs = new JobsService(queue, logger);

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
    const jobs = new JobsService(queue, logger);

    await jobs.unscheduleMonitorCheck('m-1');

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(
      monitorCheckSchedulerId('m-1'),
    );
  });

  it('no-ops schedule and unschedule without a queue', async () => {
    const jobs = new JobsService(null, logger);

    await expect(jobs.scheduleMonitorCheck('m-1', 60)).resolves.toBeUndefined();
    await expect(jobs.unscheduleMonitorCheck('m-1')).resolves.toBeUndefined();
    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue.removeJobScheduler).not.toHaveBeenCalled();
  });
});

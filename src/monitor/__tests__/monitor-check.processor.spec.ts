import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { JobsService } from '../../jobs/jobs.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitorCheckProcessor } from '../monitor-check.processor';
import { MonitorRunnerService } from '../monitor-runner.service';
import type { MonitorCheckJobData } from '../../jobs/monitor-check.job';

describe('MonitorCheckProcessor', () => {
  let processor: MonitorCheckProcessor;
  let findUnique: jest.Mock;
  let run: jest.Mock;
  let unscheduleMonitorCheck: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    run = jest.fn().mockResolvedValue({});
    unscheduleMonitorCheck = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorCheckProcessor,
        {
          provide: PrismaService,
          useValue: { monitor: { findUnique } },
        },
        {
          provide: MonitorRunnerService,
          useValue: { run },
        },
        {
          provide: JobsService,
          useValue: { unscheduleMonitorCheck },
        },
        {
          provide: LoggerService,
          useValue: { warn: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get(MonitorCheckProcessor);
  });

  function job(
    data: Partial<MonitorCheckJobData> = {},
  ): Job<MonitorCheckJobData> {
    return { id: 'job-1', data } as Job<MonitorCheckJobData>;
  }

  it('runs an enabled monitor', async () => {
    findUnique.mockResolvedValue({ id: 'm-1', enabled: true });

    await processor.process(job({ monitorId: 'm-1' }));

    expect(run).toHaveBeenCalledWith('m-1');
    expect(unscheduleMonitorCheck).not.toHaveBeenCalled();
  });

  it('unschedules a missing monitor', async () => {
    findUnique.mockResolvedValue(null);

    await processor.process(job({ monitorId: 'm-1' }));

    expect(run).not.toHaveBeenCalled();
    expect(unscheduleMonitorCheck).toHaveBeenCalledWith('m-1');
  });

  it('unschedules a disabled monitor', async () => {
    findUnique.mockResolvedValue({ id: 'm-1', enabled: false });

    await processor.process(job({ monitorId: 'm-1' }));

    expect(run).not.toHaveBeenCalled();
    expect(unscheduleMonitorCheck).toHaveBeenCalledWith('m-1');
  });
});

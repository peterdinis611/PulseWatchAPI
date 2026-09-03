import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../../jobs/jobs.service';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitorJobsSyncService } from '../monitor-jobs-sync.service';

describe('MonitorJobsSyncService', () => {
  let service: MonitorJobsSyncService;
  let findMany: jest.Mock;
  let scheduleMonitorCheck: jest.Mock;
  let unscheduleMonitorCheck: jest.Mock;
  let isEnabled: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn();
    scheduleMonitorCheck = jest.fn().mockResolvedValue(undefined);
    unscheduleMonitorCheck = jest.fn().mockResolvedValue(undefined);
    isEnabled = jest.fn().mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorJobsSyncService,
        {
          provide: PrismaService,
          useValue: { monitor: { findMany } },
        },
        {
          provide: JobsService,
          useValue: { isEnabled, scheduleMonitorCheck, unscheduleMonitorCheck },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MonitorJobsSyncService);
  });

  it('does nothing when jobs are disabled', async () => {
    isEnabled.mockReturnValue(false);

    await service.onModuleInit();

    expect(findMany).not.toHaveBeenCalled();
  });

  it('schedules enabled monitors and unschedules disabled ones', async () => {
    findMany.mockResolvedValue([
      { id: 'm-1', enabled: true, intervalSec: 60 },
      { id: 'm-2', enabled: false, intervalSec: 30 },
    ]);

    await service.onModuleInit();

    expect(scheduleMonitorCheck).toHaveBeenCalledWith('m-1', 60);
    expect(unscheduleMonitorCheck).toHaveBeenCalledWith('m-2');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../logger/logger.service';
import { CacheService } from '../../cache/cache.service';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { NotificationType } from '../../notification/notification-type';
import { NotificationService } from '../../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitorProbeService } from '../monitor-probe.service';
import { MonitorRunnerService } from '../monitor-runner.service';
import { MonitorStatus } from '../monitor-status';
import { MonitorType } from '../monitor-type';

describe('MonitorRunnerService', () => {
  let runner: MonitorRunnerService;
  let findUnique: jest.Mock;
  let findMany: jest.Mock;
  let update: jest.Mock;
  let probe: jest.Mock;
  let createForUser: jest.Mock;

  const monitor = {
    id: 'm-1',
    userId: 'user-1',
    name: 'API',
    type: MonitorType.HTTP,
    enabled: true,
    intervalSec: 60,
    timeoutMs: 1000,
    config: JSON.stringify({
      url: 'https://example.com/health',
      method: 'GET',
      expectedStatus: 200,
    }),
    lastStatus: MonitorStatus.UP,
    lastError: null,
    lastLatencyMs: 12,
    lastCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findUnique = jest.fn();
    findMany = jest.fn();
    update = jest.fn();
    probe = jest.fn();
    createForUser = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorRunnerService,
        {
          provide: PrismaService,
          useValue: {
            monitor: { findUnique, findMany, update },
          },
        },
        {
          provide: MonitorProbeService,
          useValue: { probe },
        },
        {
          provide: NotificationService,
          useValue: { createForUser },
        },
        {
          provide: LoggerService,
          useValue: { debug: jest.fn(), error: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: createTestCacheService(),
        },
      ],
    }).compile();

    runner = module.get(MonitorRunnerService);
  });

  it('notifies when a monitor goes down', async () => {
    findUnique.mockResolvedValue(monitor);
    probe.mockResolvedValue({
      status: MonitorStatus.DOWN,
      error: 'Expected HTTP 200, received 503',
      latencyMs: 20,
    });
    update.mockResolvedValue({
      ...monitor,
      lastStatus: MonitorStatus.DOWN,
      lastError: 'Expected HTTP 200, received 503',
    });

    await runner.run('m-1');

    expect(createForUser).toHaveBeenCalledWith('user-1', {
      type: NotificationType.ALERT,
      title: 'API is down',
      body: 'Expected HTTP 200, received 503',
    });
  });

  it('notifies when a monitor recovers', async () => {
    findUnique.mockResolvedValue({
      ...monitor,
      lastStatus: MonitorStatus.DOWN,
    });
    probe.mockResolvedValue({
      status: MonitorStatus.UP,
      error: null,
      latencyMs: 8,
    });
    update.mockResolvedValue({ ...monitor, lastStatus: MonitorStatus.UP });

    await runner.run('m-1');

    expect(createForUser).toHaveBeenCalledWith('user-1', {
      type: NotificationType.SUCCESS,
      title: 'API recovered',
      body: 'API is responding again',
    });
  });

  it('does not notify on the first successful check', async () => {
    findUnique.mockResolvedValue({
      ...monitor,
      lastStatus: MonitorStatus.UNKNOWN,
    });
    probe.mockResolvedValue({
      status: MonitorStatus.UP,
      error: null,
      latencyMs: 8,
    });
    update.mockResolvedValue({ ...monitor, lastStatus: MonitorStatus.UP });

    await runner.run('m-1');

    expect(createForUser).not.toHaveBeenCalled();
  });

  it('keeps the check result when notification delivery fails', async () => {
    findUnique.mockResolvedValue(monitor);
    probe.mockResolvedValue({
      status: MonitorStatus.DOWN,
      error: 'Connection refused',
      latencyMs: 20,
    });
    const updated = {
      ...monitor,
      lastStatus: MonitorStatus.DOWN,
      lastError: 'Connection refused',
    };
    update.mockResolvedValue(updated);
    createForUser.mockRejectedValue(new Error('pubsub down'));

    await expect(runner.run('m-1')).resolves.toEqual(updated);
  });

  it('continues scheduled checks when one monitor fails', async () => {
    findMany.mockResolvedValue([
      { ...monitor, id: 'm-1', lastCheckedAt: null },
      { ...monitor, id: 'm-2', lastCheckedAt: null },
    ]);
    findUnique
      .mockRejectedValueOnce(new Error('db locked'))
      .mockResolvedValue({ ...monitor, id: 'm-2' });
    probe.mockResolvedValue({
      status: MonitorStatus.UP,
      error: null,
      latencyMs: 5,
    });
    update.mockResolvedValue({
      ...monitor,
      id: 'm-2',
      lastStatus: MonitorStatus.UP,
    });

    await expect(runner.checkDue()).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
  });
});

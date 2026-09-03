import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitorRunnerService } from '../monitor-runner.service';
import { MonitorService } from '../monitor.service';
import { CacheService } from '../../cache/cache.service';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { MonitorStatus } from '../monitor-status';
import { MonitorType } from '../monitor-type';

describe('MonitorService', () => {
  let service: MonitorService;
  let findMany: jest.Mock;
  let findFirst: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;
  let deleteMany: jest.Mock;
  let run: jest.Mock;

  const row = {
    id: 'm-1',
    userId: 'user-1',
    name: 'API',
    type: MonitorType.HTTP,
    enabled: true,
    intervalSec: 60,
    timeoutMs: 10000,
    config: JSON.stringify({
      url: 'https://example.com/health',
      method: 'GET',
      expectedStatus: 200,
    }),
    lastStatus: MonitorStatus.UNKNOWN,
    lastError: null,
    lastLatencyMs: null,
    lastCheckedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findMany = jest.fn();
    findFirst = jest.fn();
    create = jest.fn();
    update = jest.fn();
    deleteMany = jest.fn();
    run = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorService,
        {
          provide: PrismaService,
          useValue: {
            monitor: { findMany, findFirst, create, update, deleteMany },
          },
        },
        {
          provide: MonitorRunnerService,
          useValue: { run },
        },
        {
          provide: CacheService,
          useValue: createTestCacheService(),
        },
      ],
    }).compile();

    service = module.get(MonitorService);
  });

  it('creates an HTTP monitor', async () => {
    create.mockResolvedValue(row);

    await expect(
      service.createForUser('user-1', {
        name: ' API ',
        type: MonitorType.HTTP,
        http: { url: 'https://example.com/health' },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'm-1',
        name: 'API',
        type: MonitorType.HTTP,
        config: {
          url: 'https://example.com/health',
          method: 'GET',
          expectedStatus: 200,
        },
      }),
    );
  });

  it('rejects HTTP create without http config', async () => {
    await expect(
      service.createForUser('user-1', {
        name: 'API',
        type: MonitorType.HTTP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists monitors for a user', async () => {
    findMany.mockResolvedValue([row]);

    await expect(service.listForUser('user-1')).resolves.toHaveLength(1);
    await expect(service.listForUser('user-1')).resolves.toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
    });
  });

  it('invalidates monitor cache after create', async () => {
    findMany.mockResolvedValue([]);
    create.mockResolvedValue(row);

    await service.listForUser('user-1');
    await service.createForUser('user-1', {
      name: 'API',
      type: MonitorType.HTTP,
      http: { url: 'https://example.com/health' },
    });
    findMany.mockResolvedValue([row]);
    await expect(service.listForUser('user-1')).resolves.toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('throws when a monitor is missing', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.findForUser('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an owned monitor', async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.deleteForUser('user-1', 'm-1')).resolves.toBe(true);
  });

  it('throws when deleting a missing monitor', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.deleteForUser('user-1', 'm-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('requires config when changing type', async () => {
    findFirst.mockResolvedValue(row);

    await expect(
      service.updateForUser('user-1', 'm-1', { type: MonitorType.TCP }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('runs a check for an owned monitor', async () => {
    findFirst.mockResolvedValue(row);
    run.mockResolvedValue({ ...row, lastStatus: MonitorStatus.UP });

    await expect(service.checkForUser('user-1', 'm-1')).resolves.toEqual(
      expect.objectContaining({ lastStatus: MonitorStatus.UP }),
    );
    expect(run).toHaveBeenCalledWith('m-1');
  });
});

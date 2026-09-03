import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { CacheKeys } from '../../cache/cache.keys';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { MonitorSettingsService } from '../monitor-settings.service';

describe('MonitorSettingsService', () => {
  let service: MonitorSettingsService;
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let upsert: jest.Mock;
  let cache: CacheService;

  const row = {
    userId: 'user-1',
    defaultIntervalSec: 60,
    defaultTimeoutMs: 10000,
    notifyOnDown: true,
    notifyOnRecover: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findUnique = jest.fn();
    create = jest.fn();
    upsert = jest.fn();
    cache = createTestCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorSettingsService,
        {
          provide: PrismaService,
          useValue: {
            userMonitorSettings: { findUnique, create, upsert },
          },
        },
        {
          provide: CacheService,
          useValue: cache,
        },
      ],
    }).compile();

    service = module.get(MonitorSettingsService);
  });

  it('returns existing settings', async () => {
    findUnique.mockResolvedValue(row);

    await expect(service.getForUser('user-1')).resolves.toEqual({
      defaultIntervalSec: 60,
      defaultTimeoutMs: 10000,
      notifyOnDown: true,
      notifyOnRecover: true,
      updatedAt: row.updatedAt,
    });
    await expect(service.getForUser('user-1')).resolves.toEqual(
      expect.objectContaining({ defaultIntervalSec: 60 }),
    );
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates defaults when the user has no row', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ ...row, defaultIntervalSec: 120 });

    await expect(service.getForUser('user-1')).resolves.toEqual(
      expect.objectContaining({ defaultIntervalSec: 120 }),
    );
    expect(create).toHaveBeenCalledWith({
      data: { userId: 'user-1' },
      select: expect.any(Object),
    });
  });

  it('reloads when a concurrent create hits a unique constraint', async () => {
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...row, notifyOnDown: false });
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );

    await expect(service.getForUser('user-1')).resolves.toEqual(
      expect.objectContaining({ notifyOnDown: false }),
    );
  });

  it('updates and invalidates cache', async () => {
    findUnique.mockResolvedValue(row);
    upsert.mockResolvedValue({
      ...row,
      defaultIntervalSec: 30,
      notifyOnDown: false,
    });

    await service.getForUser('user-1');
    const updated = await service.updateForUser('user-1', {
      defaultIntervalSec: 30,
      notifyOnDown: false,
    });

    expect(updated.defaultIntervalSec).toBe(30);
    expect(updated.notifyOnDown).toBe(false);
    expect(cache.get(CacheKeys.monitorSettings('user-1'))).toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: {
          defaultIntervalSec: 30,
          notifyOnDown: false,
        },
      }),
    );
  });
});

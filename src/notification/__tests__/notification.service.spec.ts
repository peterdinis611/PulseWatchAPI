import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PubSubService } from '../../pubsub/pubsub.service';
import { CacheService } from '../../cache/cache.service';
import { createTestCacheService } from '../../cache/__tests__/create-test-cache';
import { notificationReceivedTrigger } from '../notification.events';
import { NotificationType } from '../notification-type';
import { NotificationService } from '../notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let create: jest.Mock;
  let findMany: jest.Mock;
  let count: jest.Mock;
  let findFirst: jest.Mock;
  let update: jest.Mock;
  let updateMany: jest.Mock;
  let publish: jest.Mock;

  const record = {
    id: 'n-1',
    userId: 'user-1',
    type: NotificationType.ALERT,
    title: 'Monitor down',
    body: 'api.pulsewatch.dev is unreachable',
    monitorId: null,
    stressTestId: null,
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    create = jest.fn();
    findMany = jest.fn();
    count = jest.fn();
    findFirst = jest.fn();
    update = jest.fn();
    updateMany = jest.fn();
    publish = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create,
              findMany,
              count,
              findFirst,
              update,
              updateMany,
            },
          },
        },
        {
          provide: PubSubService,
          useValue: { publish },
        },
        {
          provide: LoggerService,
          useValue: { debug: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: createTestCacheService(),
        },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  it('creates a notification and publishes to the user channel', async () => {
    create.mockResolvedValue(record);

    await expect(
      service.createForUser('user-1', {
        type: NotificationType.ALERT,
        title: record.title,
        body: record.body,
      }),
    ).resolves.toEqual(record);

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: NotificationType.ALERT,
        title: record.title,
        body: record.body,
        monitorId: null,
        stressTestId: null,
      },
      select: expect.any(Object),
    });
    expect(publish).toHaveBeenCalledWith(
      notificationReceivedTrigger('user-1'),
      { notificationReceived: record },
    );
  });

  it('lists notifications newest first', async () => {
    findMany.mockResolvedValue([record]);

    await expect(service.listForUser('user-1')).resolves.toEqual([record]);
    await expect(service.listForUser('user-1')).resolves.toEqual([record]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
    });
  });

  it('invalidates notification cache after create', async () => {
    findMany.mockResolvedValue([record]);
    create.mockResolvedValue(record);

    await service.listForUser('user-1');
    await service.createForUser('user-1', {
      type: NotificationType.ALERT,
      title: record.title,
      body: record.body,
    });
    await service.listForUser('user-1');

    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('lists only unread notifications', async () => {
    findMany.mockResolvedValue([]);

    await service.listForUser('user-1', true);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
    });
  });

  it('counts unread notifications', async () => {
    count.mockResolvedValue(3);

    await expect(service.unreadCount('user-1')).resolves.toBe(3);
    await expect(service.unreadCount('user-1')).resolves.toBe(3);
    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
    });
  });

  it('caches an unread count of zero', async () => {
    count.mockResolvedValue(0);

    await expect(service.unreadCount('user-1')).resolves.toBe(0);
    await expect(service.unreadCount('user-1')).resolves.toBe(0);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('marks an unread notification as read', async () => {
    const read = { ...record, readAt: new Date('2026-01-02T00:00:00.000Z') };
    findFirst.mockResolvedValue(record);
    update.mockResolvedValue(read);

    await expect(service.markRead('user-1', 'n-1')).resolves.toEqual(read);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { readAt: expect.any(Date) },
      select: expect.any(Object),
    });
  });

  it('returns an already-read notification without updating', async () => {
    const read = { ...record, readAt: new Date('2026-01-02T00:00:00.000Z') };
    findFirst.mockResolvedValue(read);

    await expect(service.markRead('user-1', 'n-1')).resolves.toEqual(read);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws when marking a missing notification', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.markRead('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks all unread notifications as read', async () => {
    updateMany.mockResolvedValue({ count: 2 });

    await expect(service.markAllRead('user-1')).resolves.toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

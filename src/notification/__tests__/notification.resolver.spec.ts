import { Test, TestingModule } from '@nestjs/testing';
import { PubSubService } from '../../pubsub/pubsub.service';
import type { PublicUser } from '../../user/public-user';
import { notificationReceivedTrigger } from '../notification.events';
import { NotificationType } from '../notification-type';
import { NotificationResolver } from '../notification.resolver';
import { NotificationService } from '../notification.service';

describe('NotificationResolver', () => {
  let resolver: NotificationResolver;
  let listForUser: jest.Mock;
  let unreadCount: jest.Mock;
  let markRead: jest.Mock;
  let markAllRead: jest.Mock;
  let asyncIterator: jest.Mock;

  const user: PublicUser = {
    id: 'user-1',
    email: 'ada@pulsewatch.dev',
    name: 'Ada',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const record = {
    id: 'n-1',
    userId: 'user-1',
    type: NotificationType.INFO,
    title: 'Welcome',
    body: 'PulseWatch is watching',
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    listForUser = jest.fn().mockResolvedValue([record]);
    unreadCount = jest.fn().mockResolvedValue(1);
    markRead = jest.fn().mockResolvedValue(record);
    markAllRead = jest.fn().mockResolvedValue(1);
    asyncIterator = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationResolver,
        {
          provide: NotificationService,
          useValue: { listForUser, unreadCount, markRead, markAllRead },
        },
        {
          provide: PubSubService,
          useValue: { asyncIterator },
        },
      ],
    }).compile();

    resolver = module.get(NotificationResolver);
  });

  it('lists notifications for the current user', async () => {
    await expect(resolver.notifications(user, true)).resolves.toEqual([record]);
    expect(listForUser).toHaveBeenCalledWith('user-1', true);
  });

  it('defaults unreadOnly to false', async () => {
    await resolver.notifications(user);
    expect(listForUser).toHaveBeenCalledWith('user-1', false);
  });

  it('returns the unread count', async () => {
    await expect(resolver.unreadNotificationCount(user)).resolves.toBe(1);
    expect(unreadCount).toHaveBeenCalledWith('user-1');
  });

  it('marks a notification as read', async () => {
    await expect(resolver.markNotificationRead(user, 'n-1')).resolves.toEqual(
      record,
    );
    expect(markRead).toHaveBeenCalledWith('user-1', 'n-1');
  });

  it('marks all notifications as read', async () => {
    await expect(resolver.markAllNotificationsRead(user)).resolves.toBe(1);
    expect(markAllRead).toHaveBeenCalledWith('user-1');
  });

  it('subscribes on the current user channel', () => {
    const iterator = {} as AsyncIterableIterator<{
      notificationReceived: typeof record;
    }>;
    asyncIterator.mockReturnValue(iterator);

    expect(resolver.notificationReceived(user)).toBe(iterator);
    expect(asyncIterator).toHaveBeenCalledWith(
      notificationReceivedTrigger('user-1'),
    );
  });
});

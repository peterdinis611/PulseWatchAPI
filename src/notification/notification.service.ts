import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache.keys';
import { notificationReceivedTrigger } from './notification.events';
import { NotificationType } from './notification-type';

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  monitorId: true,
  stressTestId: true,
  readAt: true,
  createdAt: true,
} as const;

export type NotificationRecord = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  monitorId: string | null;
  stressTestId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type CreateNotificationData = {
  type: NotificationType;
  title: string;
  body: string;
  monitorId?: string | null;
  stressTestId?: string | null;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pubSub: PubSubService,
    private readonly logger: LoggerService,
    private readonly cache: CacheService,
  ) {}

  async createForUser(
    userId: string,
    data: CreateNotificationData,
  ): Promise<NotificationRecord> {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        monitorId: data.monitorId ?? null,
        stressTestId: data.stressTestId ?? null,
      },
      select: notificationSelect,
    });

    await this.pubSub.publish(notificationReceivedTrigger(userId), {
      notificationReceived: notification,
    });
    this.cache.invalidatePrefix(CacheKeys.notificationsPrefix(userId));

    this.logger.debug(
      `Created ${notification.type} notification ${notification.id} for ${userId}`,
      NotificationService.name,
    );

    return notification as NotificationRecord;
  }

  listForUser(
    userId: string,
    unreadOnly = false,
  ): Promise<NotificationRecord[]> {
    return this.cache.wrap(
      CacheKeys.notificationsList(userId, unreadOnly),
      () =>
        this.prisma.notification.findMany({
          where: {
            userId,
            ...(unreadOnly ? { readAt: null } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: notificationSelect,
        }),
    ) as Promise<NotificationRecord[]>;
  }

  unreadCount(userId: string): Promise<number> {
    return this.cache.wrap(CacheKeys.notificationsUnreadCount(userId), () =>
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    );
  }

  async markRead(userId: string, id: string): Promise<NotificationRecord> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });

    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (existing.readAt) {
      return existing as NotificationRecord;
    }

    const updated = (await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      select: notificationSelect,
    })) as NotificationRecord;
    this.cache.invalidatePrefix(CacheKeys.notificationsPrefix(userId));
    return updated;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    this.cache.invalidatePrefix(CacheKeys.notificationsPrefix(userId));

    return result.count;
  }
}

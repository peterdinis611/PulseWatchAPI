import { UseGuards } from '@nestjs/common';
import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { PubSubService } from '../pubsub/pubsub.service';
import type { PublicUser } from '../user/public-user';
import { notificationReceivedTrigger } from './notification.events';
import { Notification } from './notification.model';
import {
  NotificationRecord,
  NotificationService,
} from './notification.service';

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pubSub: PubSubService,
  ) {}

  @Query(() => [Notification], {
    description: 'Notifications for the signed-in user, newest first',
  })
  @UseGuards(GqlAuthGuard)
  notifications(
    @CurrentUser() user: PublicUser,
    @Args('unreadOnly', { type: () => Boolean, nullable: true })
    unreadOnly?: boolean,
  ): Promise<NotificationRecord[]> {
    return this.notificationService.listForUser(user.id, unreadOnly ?? false);
  }

  @Query(() => Int, {
    description: 'Unread notification count for the signed-in user',
  })
  @UseGuards(GqlAuthGuard)
  unreadNotificationCount(@CurrentUser() user: PublicUser): Promise<number> {
    return this.notificationService.unreadCount(user.id);
  }

  @Mutation(() => Notification, {
    description: 'Mark a notification as read',
  })
  @UseGuards(GqlAuthGuard)
  markNotificationRead(
    @CurrentUser() user: PublicUser,
    @Args('id') id: string,
  ): Promise<NotificationRecord> {
    return this.notificationService.markRead(user.id, id);
  }

  @Mutation(() => Int, {
    description: 'Mark every unread notification as read',
  })
  @UseGuards(GqlAuthGuard)
  markAllNotificationsRead(@CurrentUser() user: PublicUser): Promise<number> {
    return this.notificationService.markAllRead(user.id);
  }

  @Subscription(() => Notification, {
    description: 'Emits when the signed-in user receives a notification',
  })
  @UseGuards(GqlAuthGuard)
  notificationReceived(
    @CurrentUser() user: PublicUser,
  ): AsyncIterableIterator<{ notificationReceived: NotificationRecord }> {
    return this.pubSub.asyncIterator(notificationReceivedTrigger(user.id));
  }
}

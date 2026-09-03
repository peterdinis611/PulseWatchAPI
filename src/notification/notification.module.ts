import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertDeliveryService } from './alert-delivery.service';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationService, NotificationResolver, AlertDeliveryService],
  exports: [NotificationService, AlertDeliveryService],
})
export class NotificationModule {}

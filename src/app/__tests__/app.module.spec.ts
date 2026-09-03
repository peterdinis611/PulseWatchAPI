import { MODULE_METADATA } from '@nestjs/common/constants';
import { HealthModule } from '../../health/health.module';
import { LoggerModule } from '../../logger/logger.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PubSubModule } from '../../pubsub/pubsub.module';
import { AuthModule } from '../../auth/auth.module';
import { NotificationModule } from '../../notification/notification.module';
import { MonitorModule } from '../../monitor/monitor.module';
import { CacheModule } from '../../cache/cache.module';
import { JobsModule } from '../../jobs/jobs.module';
import { UserModule } from '../../user/user.module';
import { AppController } from '../app.controller';
import { AppModule } from '../app.module';

describe('AppModule', () => {
  it('registers AppController', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AppModule,
    ) as unknown[];

    expect(controllers).toEqual(expect.arrayContaining([AppController]));
  });

  it('imports Prisma, Health, Logger, PubSub, Cache, Jobs, User, Auth, Notification and Monitor modules', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AppModule,
    ) as unknown[];

    expect(imports).toEqual(
      expect.arrayContaining([
        PrismaModule,
        HealthModule,
        LoggerModule,
        PubSubModule,
        CacheModule,
        JobsModule,
        UserModule,
        AuthModule,
        NotificationModule,
        MonitorModule,
      ]),
    );
  });
});

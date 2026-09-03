import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AuthModule } from '../auth/auth.module';
import { createGqlContext } from '../graphql/create-gql-context';
import { HealthModule } from '../health/health.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PubSubModule } from '../pubsub/pubsub.module';
import { CacheModule } from '../cache/cache.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationModule } from '../notification/notification.module';
import { MonitorModule } from '../monitor/monitor.module';
import { UserModule } from '../user/user.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      path: '/graphql',
      playground: false,
      introspection: true,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      subscriptions: {
        'graphql-ws': {
          path: '/graphql',
        },
      },
      context: createGqlContext,
    }),
    PrismaModule,
    LoggerModule,
    PubSubModule,
    CacheModule,
    JobsModule,
    HealthModule,
    UserModule,
    AuthModule,
    NotificationModule,
    MonitorModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { HealthModule } from '../health/health.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
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
    }),
    PrismaModule,
    LoggerModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

import { AddressInfo } from 'node:net';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app/app.module';
import { createAppValidationPipe } from '../src/common/create-validation-pipe';

export async function createTestingApp(): Promise<INestApplication<App>> {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'file:./data/test.sqlite';
  process.env.JWT_SECRET ??= 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN ??= '1h';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(createAppValidationPipe());
  await app.init();
  return app;
}

export async function createListeningTestingApp(): Promise<{
  app: INestApplication<App>;
  port: number;
}> {
  const app = await createTestingApp();
  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo | string | null;
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP listen address');
  }
  return { app, port: address.port };
}

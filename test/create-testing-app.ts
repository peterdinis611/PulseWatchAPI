import { App } from 'supertest/types';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app/app.module';

export async function createTestingApp(): Promise<INestApplication<App>> {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'file:./data/test.sqlite';
  process.env.JWT_SECRET ??= 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN ??= '1h';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

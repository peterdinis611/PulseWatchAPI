process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface HealthBody {
  status: string;
  database: string;
  timestamp: string;
}

interface HealthQueryResponse {
  data: {
    health: HealthBody;
  };
}

describe('PulseWatch API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('GET /health', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as HealthBody;
        expect(body.status).toBe('ok');
        expect(body.database).toBe('connected');
        expect(body.timestamp).toEqual(expect.any(String));
      });
  });

  it('GraphQL health query', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health { status database timestamp } }' })
      .expect(200)
      .expect((res) => {
        const body = res.body as HealthQueryResponse;
        expect(body.data.health.status).toBe('ok');
        expect(body.data.health.database).toBe('connected');
        expect(body.data.health.timestamp).toEqual(expect.any(String));
      });
  });

  afterEach(async () => {
    await app.close();
  });
});

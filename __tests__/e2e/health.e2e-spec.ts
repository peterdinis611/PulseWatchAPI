process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestingApp } from './create-testing-app';

interface HealthQueryResponse {
  data: {
    health: {
      status: string;
      database: string;
      timestamp: string;
    };
  };
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestingApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GraphQL health query returns connected status', () => {
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
});

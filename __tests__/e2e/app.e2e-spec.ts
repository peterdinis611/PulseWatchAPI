process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestingApp } from './create-testing-app';

interface HealthBody {
  status: string;
  database: string;
  timestamp: string;
}

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestingApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns connected status', () => {
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
});

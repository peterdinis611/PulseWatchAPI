process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';

import { INestApplication } from '@nestjs/common';
import { createClient } from 'graphql-ws';
import request from 'supertest';
import { App } from 'supertest/types';
import WebSocket from 'ws';
import { createListeningTestingApp } from './create-testing-app';

const HEALTH_UPDATED_SUBSCRIPTION = `
  subscription {
    healthUpdated {
      status
      database
      timestamp
    }
  }
`;

describe('Health subscriptions (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;

  beforeEach(async () => {
    ({ app, port } = await createListeningTestingApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('emits healthUpdated when a health query runs', async () => {
    const client = createClient({
      url: `ws://127.0.0.1:${port}/graphql`,
      webSocketImpl: WebSocket,
      retryAttempts: 0,
      lazy: false,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const offConnected = client.on('connected', () => {
          offConnected();
          resolve();
        });
        client.on('error', reject);
      });

      const nextEvent = new Promise<{
        data?: {
          healthUpdated: {
            status: string;
            database: string;
            timestamp: string;
          };
        };
      }>((resolve, reject) => {
        const unsubscribe = client.subscribe(
          { query: HEALTH_UPDATED_SUBSCRIPTION },
          {
            next: (result) => {
              unsubscribe();
              resolve(result);
            },
            error: reject,
            complete: () => undefined,
          },
        );
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: '{ health { status database timestamp } }' })
        .expect(200);

      const result = await nextEvent;
      expect(result.data?.healthUpdated.status).toBe('ok');
      expect(result.data?.healthUpdated.database).toBe('connected');
      expect(result.data?.healthUpdated.timestamp).toEqual(expect.any(String));
    } finally {
      await client.dispose();
    }
  });
});

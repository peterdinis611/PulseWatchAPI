process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

import { INestApplication } from '@nestjs/common';
import { createClient } from 'graphql-ws';
import request from 'supertest';
import { App } from 'supertest/types';
import WebSocket from 'ws';
import { NotificationType } from '../src/notification/notification-type';
import { NotificationService } from '../src/notification/notification.service';
import { createListeningTestingApp } from './create-testing-app';

const NOTIFICATION_RECEIVED = `
  subscription {
    notificationReceived {
      id
      type
      title
      body
      readAt
    }
  }
`;

interface GraphQLBody<T> {
  data?: T;
  errors?: { message: string }[];
}

async function register(
  app: INestApplication<App>,
  email: string,
): Promise<{ accessToken: string; user: { id: string } }> {
  const res = await request(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            accessToken
            user { id }
          }
        }
      `,
      variables: {
        input: { email, password: 'password1' },
      },
    })
    .expect(200);

  const body = res.body as GraphQLBody<{
    register: { accessToken: string; user: { id: string } };
  }>;
  const registered = body.data?.register;
  if (!registered) {
    throw new Error(body.errors?.[0]?.message ?? 'register failed');
  }
  return registered;
}

describe('Notification subscriptions (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;

  beforeEach(async () => {
    ({ app, port } = await createListeningTestingApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated notification subscriptions', async () => {
    const client = createClient({
      url: `ws://127.0.0.1:${port}/graphql`,
      webSocketImpl: WebSocket,
      retryAttempts: 0,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        client.subscribe(
          { query: NOTIFICATION_RECEIVED },
          {
            next: () => reject(new Error('expected authorization error')),
            error: (error) => {
              expect(String(error)).toMatch(/Unauthorized/i);
              resolve();
            },
            complete: () => reject(new Error('completed without error')),
          },
        );
      });
    } finally {
      await client.dispose();
    }
  });

  it('emits notificationReceived to the signed-in user', async () => {
    const ada = await register(app, `ada-${Date.now()}@pulsewatch.dev`);
    const client = createClient({
      url: `ws://127.0.0.1:${port}/graphql`,
      webSocketImpl: WebSocket,
      retryAttempts: 0,
      lazy: false,
      connectionParams: {
        Authorization: `Bearer ${ada.accessToken}`,
      },
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
          notificationReceived: {
            id: string;
            type: string;
            title: string;
            body: string;
            readAt: string | null;
          };
        };
        errors?: { message: string }[];
      }>((resolve, reject) => {
        const unsubscribe = client.subscribe(
          { query: NOTIFICATION_RECEIVED },
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

      const created = await app
        .get(NotificationService)
        .createForUser(ada.user.id, {
          type: NotificationType.ALERT,
          title: 'Monitor down',
          body: 'api.pulsewatch.dev is unreachable',
        });

      const result = await nextEvent;
      expect(result.errors).toBeUndefined();
      expect(result.data?.notificationReceived).toEqual({
        id: created.id,
        type: 'ALERT',
        title: 'Monitor down',
        body: 'api.pulsewatch.dev is unreachable',
        readAt: null,
      });
    } finally {
      await client.dispose();
    }
  });
});

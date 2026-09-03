process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { NotificationType } from '../src/notification/notification-type';
import { NotificationService } from '../src/notification/notification.service';
import { createTestingApp } from './create-testing-app';

interface GraphQLBody<T> {
  data?: T;
  errors?: { message: string }[];
}

interface AuthPayloadBody {
  accessToken: string;
  user: { id: string; email: string };
}

interface NotificationBody {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

async function gql<T>(
  app: INestApplication<App>,
  query: string,
  options?: { token?: string; variables?: Record<string, unknown> },
): Promise<GraphQLBody<T>> {
  const req = request(app.getHttpServer()).post('/graphql');
  if (options?.token) {
    req.set('Authorization', `Bearer ${options.token}`);
  }
  const res = await req
    .send({ query, variables: options?.variables })
    .expect(200);
  return res.body as GraphQLBody<T>;
}

async function register(
  app: INestApplication<App>,
  email: string,
): Promise<AuthPayloadBody> {
  const body = await gql<{ register: AuthPayloadBody }>(
    app,
    `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          accessToken
          user { id email }
        }
      }
    `,
    {
      variables: {
        input: { email, password: 'password1', name: 'Ada' },
      },
    },
  );

  const registered = body.data?.register;
  if (!registered) {
    throw new Error(body.errors?.[0]?.message ?? 'register failed');
  }
  return registered;
}

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestingApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated notification queries', async () => {
    const body = await gql(app, '{ notifications { id } }');
    expect(body.errors?.[0]?.message).toMatch(/Unauthorized/i);
  });

  it('lists, counts, and marks notifications for the owner only', async () => {
    const ada = await register(app, `ada-${Date.now()}@pulsewatch.dev`);
    const grace = await register(app, `grace-${Date.now()}@pulsewatch.dev`);
    const notifications = app.get(NotificationService);

    const created = await notifications.createForUser(ada.user.id, {
      type: NotificationType.ALERT,
      title: 'Monitor down',
      body: 'api.pulsewatch.dev is unreachable',
    });

    const graceNotification = await notifications.createForUser(grace.user.id, {
      type: NotificationType.INFO,
      title: 'Welcome',
      body: 'PulseWatch is watching',
    });

    const list = await gql<{ notifications: NotificationBody[] }>(
      app,
      '{ notifications { id type title body readAt } }',
      { token: ada.accessToken },
    );
    expect(list.data?.notifications).toEqual([
      {
        id: created.id,
        type: 'ALERT',
        title: 'Monitor down',
        body: 'api.pulsewatch.dev is unreachable',
        readAt: null,
      },
    ]);

    const unread = await gql<{ unreadNotificationCount: number }>(
      app,
      '{ unreadNotificationCount }',
      { token: ada.accessToken },
    );
    expect(unread.data?.unreadNotificationCount).toBe(1);

    const stolen = await gql<{ markNotificationRead: NotificationBody }>(
      app,
      `
        mutation MarkRead($id: String!) {
          markNotificationRead(id: $id) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: { id: graceNotification.id },
      },
    );
    expect(stolen.errors?.[0]?.message).toMatch(/not found/i);

    const marked = await gql<{ markNotificationRead: NotificationBody }>(
      app,
      `
        mutation MarkRead($id: String!) {
          markNotificationRead(id: $id) { id readAt }
        }
      `,
      { token: ada.accessToken, variables: { id: created.id } },
    );
    expect(marked.data?.markNotificationRead.id).toBe(created.id);
    expect(marked.data?.markNotificationRead.readAt).toEqual(
      expect.any(String),
    );

    const afterRead = await gql<{ unreadNotificationCount: number }>(
      app,
      '{ unreadNotificationCount }',
      { token: ada.accessToken },
    );
    expect(afterRead.data?.unreadNotificationCount).toBe(0);

    await notifications.createForUser(ada.user.id, {
      type: NotificationType.SUCCESS,
      title: 'Monitor recovered',
      body: 'api.pulsewatch.dev is up',
    });

    const cleared = await gql<{ markAllNotificationsRead: number }>(
      app,
      'mutation { markAllNotificationsRead }',
      { token: ada.accessToken },
    );
    expect(cleared.data?.markAllNotificationsRead).toBe(1);

    const unreadOnly = await gql<{ notifications: NotificationBody[] }>(
      app,
      '{ notifications(unreadOnly: true) { id } }',
      { token: ada.accessToken },
    );
    expect(unreadOnly.data?.notifications).toEqual([]);
  });
});

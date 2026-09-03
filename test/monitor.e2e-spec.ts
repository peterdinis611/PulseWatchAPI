process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./data/test.sqlite';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createListeningTestingApp } from './create-testing-app';

interface GraphQLBody<T> {
  data?: T;
  errors?: { message: string }[];
}

interface AuthPayloadBody {
  accessToken: string;
  user: { id: string };
}

interface MonitorBody {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  lastStatus: string;
  lastError: string | null;
  config: {
    url?: string;
    host?: string;
    port?: number;
    expectedStatus?: number;
  };
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
          user { id }
        }
      }
    `,
    {
      variables: { input: { email, password: 'password1' } },
    },
  );
  const registered = body.data?.register;
  if (!registered) {
    throw new Error(body.errors?.[0]?.message ?? 'register failed');
  }
  return registered;
}

const MONITOR_FIELDS = `
  id
  name
  type
  enabled
  lastStatus
  lastError
  config { url host port expectedStatus }
`;

describe('Monitors (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;

  beforeEach(async () => {
    ({ app, port } = await createListeningTestingApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated monitor queries', async () => {
    const body = await gql(app, '{ monitors { id } }');
    expect(body.errors?.[0]?.message).toMatch(/Unauthorized/i);
  });

  it('rejects invalid monitor input with readable errors', async () => {
    const ada = await register(app, `ada-${Date.now()}@pulsewatch.dev`);

    const missingHttp = await gql(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: { input: { name: 'Site', type: 'HTTP' } },
      },
    );
    expect(missingHttp.errors?.[0]?.message).toMatch(
      /http config is required/i,
    );

    const extraConfig = await gql(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: 'Site',
            type: 'HTTP',
            http: { url: 'https://example.com' },
            redis: { url: 'redis://localhost:6379' },
          },
        },
      },
    );
    expect(extraConfig.errors?.[0]?.message).toMatch(
      /cannot include redis config/i,
    );

    const blankName = await gql(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: '   ',
            type: 'HTTP',
            http: { url: 'https://example.com' },
          },
        },
      },
    );
    expect(blankName.errors?.[0]?.message).toMatch(/name is required/i);

    const badId = await gql(app, '{ monitor(id: "not-a-uuid") { id } }', {
      token: ada.accessToken,
    });
    expect(badId.errors?.[0]?.message).toMatch(/uuid/i);
  });

  it('creates, checks, and isolates monitors', async () => {
    const ada = await register(app, `ada-${Date.now()}@pulsewatch.dev`);
    const grace = await register(app, `grace-${Date.now()}@pulsewatch.dev`);

    const created = await gql<{ createMonitor: MonitorBody }>(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { ${MONITOR_FIELDS} }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: 'PulseWatch health',
            type: 'HTTP',
            intervalSec: 30,
            http: {
              url: `http://127.0.0.1:${port}/health`,
              expectedStatus: 200,
            },
          },
        },
      },
    );

    expect(created.errors).toBeUndefined();
    expect(created.data?.createMonitor).toEqual(
      expect.objectContaining({
        name: 'PulseWatch health',
        type: 'HTTP',
        lastStatus: 'UNKNOWN',
        config: expect.objectContaining({
          url: `http://127.0.0.1:${port}/health`,
          expectedStatus: 200,
        }),
      }),
    );

    const healthId = created.data?.createMonitor.id as string;

    const checked = await gql<{ runMonitorCheck: MonitorBody }>(
      app,
      `
        mutation Check($id: String!) {
          runMonitorCheck(id: $id) { ${MONITOR_FIELDS} }
        }
      `,
      { token: ada.accessToken, variables: { id: healthId } },
    );
    expect(checked.data?.runMonitorCheck.lastStatus).toBe('UP');

    const down = await gql<{ createMonitor: MonitorBody }>(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: 'Missing route',
            type: 'HTTP',
            http: {
              url: `http://127.0.0.1:${port}/definitely-missing`,
              expectedStatus: 200,
            },
          },
        },
      },
    );
    const downId = down.data?.createMonitor.id as string;

    const failed = await gql<{ runMonitorCheck: MonitorBody }>(
      app,
      `
        mutation Check($id: String!) {
          runMonitorCheck(id: $id) { lastStatus lastError }
        }
      `,
      { token: ada.accessToken, variables: { id: downId } },
    );
    expect(failed.data?.runMonitorCheck.lastStatus).toBe('DOWN');
    expect(failed.data?.runMonitorCheck.lastError).toMatch(/404/);

    const alerts = await gql<{ unreadNotificationCount: number }>(
      app,
      '{ unreadNotificationCount }',
      { token: ada.accessToken },
    );
    expect(alerts.data?.unreadNotificationCount).toBeGreaterThanOrEqual(1);

    const tcp = await gql<{ createMonitor: MonitorBody }>(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: 'GraphQL port',
            type: 'TCP',
            tcp: { host: '127.0.0.1', port },
          },
        },
      },
    );

    const tcpCheck = await gql<{ runMonitorCheck: MonitorBody }>(
      app,
      `
        mutation Check($id: String!) {
          runMonitorCheck(id: $id) { lastStatus }
        }
      `,
      {
        token: ada.accessToken,
        variables: { id: tcp.data?.createMonitor.id },
      },
    );
    expect(tcpCheck.data?.runMonitorCheck.lastStatus).toBe('UP');

    const ssl = await gql<{ createMonitor: MonitorBody }>(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id type config { host port } }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: 'TLS endpoint',
            type: 'SSL',
            ssl: { host: '127.0.0.1', port: 1 },
          },
        },
      },
    );
    expect(ssl.data?.createMonitor.type).toBe('SSL');
    expect(ssl.data?.createMonitor.config).toEqual(
      expect.objectContaining({ host: '127.0.0.1', port: 1 }),
    );

    const sslCheck = await gql<{ runMonitorCheck: MonitorBody }>(
      app,
      `
        mutation Check($id: String!) {
          runMonitorCheck(id: $id) { lastStatus lastError }
        }
      `,
      {
        token: ada.accessToken,
        variables: { id: ssl.data?.createMonitor.id },
      },
    );
    expect(sslCheck.data?.runMonitorCheck.lastStatus).toBe('DOWN');

    const db = await gql<{ createMonitor: MonitorBody }>(
      app,
      `
        mutation Create($input: CreateMonitorInput!) {
          createMonitor(input: $input) { id }
        }
      `,
      {
        token: ada.accessToken,
        variables: {
          input: {
            name: 'SQLite',
            type: 'DATABASE',
            database: { url: 'file:./data/test.sqlite' },
          },
        },
      },
    );

    const dbCheck = await gql<{ runMonitorCheck: MonitorBody }>(
      app,
      `
        mutation Check($id: String!) {
          runMonitorCheck(id: $id) { lastStatus lastError }
        }
      `,
      {
        token: ada.accessToken,
        variables: { id: db.data?.createMonitor.id },
      },
    );
    expect(dbCheck.data?.runMonitorCheck.lastStatus).toBe('UP');

    const stolen = await gql(
      app,
      `
        mutation Check($id: String!) {
          runMonitorCheck(id: $id) { id }
        }
      `,
      { token: grace.accessToken, variables: { id: healthId } },
    );
    expect(stolen.errors?.[0]?.message).toMatch(/not found/i);

    const removed = await gql<{ deleteMonitor: boolean }>(
      app,
      `
        mutation Delete($id: String!) {
          deleteMonitor(id: $id)
        }
      `,
      { token: ada.accessToken, variables: { id: downId } },
    );
    expect(removed.data?.deleteMonitor).toBe(true);
  });
});

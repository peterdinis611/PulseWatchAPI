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

interface StressTestBody {
  id: string;
  name: string;
  url: string;
  method: string;
  vus: number;
  durationSec: number;
  lastStatus: string;
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

const STRESS_TEST_FIELDS = `
  id
  name
  url
  method
  vus
  durationSec
  lastStatus
`;

describe('Stress tests (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    ({ app } = await createListeningTestingApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, lists, updates and deletes a k6 stress test', async () => {
    const auth = await register(app, 'stress@pulsewatch.dev');

    const created = await gql<{ createStressTest: StressTestBody }>(
      app,
      `
        mutation Create($input: CreateStressTestInput!) {
          createStressTest(input: $input) {
            ${STRESS_TEST_FIELDS}
          }
        }
      `,
      {
        token: auth.accessToken,
        variables: {
          input: {
            name: 'Checkout load',
            url: 'https://example.com/checkout',
            vus: 5,
            durationSec: 10,
            p95Ms: 400,
            maxFailRate: 0.05,
          },
        },
      },
    );

    expect(created.errors).toBeUndefined();
    expect(created.data?.createStressTest).toEqual(
      expect.objectContaining({
        name: 'Checkout load',
        url: 'https://example.com/checkout',
        method: 'GET',
        vus: 5,
        durationSec: 10,
        lastStatus: 'IDLE',
      }),
    );

    const id = created.data?.createStressTest.id;
    expect(id).toBeDefined();

    const listed = await gql<{ stressTests: StressTestBody[] }>(
      app,
      `query { stressTests { ${STRESS_TEST_FIELDS} } }`,
      { token: auth.accessToken },
    );
    expect(listed.data?.stressTests).toHaveLength(1);

    const updated = await gql<{ updateStressTest: StressTestBody }>(
      app,
      `
        mutation Update($id: String!, $input: UpdateStressTestInput!) {
          updateStressTest(id: $id, input: $input) {
            ${STRESS_TEST_FIELDS}
          }
        }
      `,
      {
        token: auth.accessToken,
        variables: { id, input: { name: 'Checkout load v2', vus: 8 } },
      },
    );
    expect(updated.data?.updateStressTest.name).toBe('Checkout load v2');
    expect(updated.data?.updateStressTest.vus).toBe(8);

    const runs = await gql<{ stressTestRuns: { id: string }[] }>(
      app,
      `
        query Runs($id: String!) {
          stressTestRuns(id: $id) { id }
        }
      `,
      { token: auth.accessToken, variables: { id } },
    );
    expect(runs.data?.stressTestRuns).toEqual([]);

    const deleted = await gql<{ deleteStressTest: boolean }>(
      app,
      `
        mutation Delete($id: String!) {
          deleteStressTest(id: $id)
        }
      `,
      { token: auth.accessToken, variables: { id } },
    );
    expect(deleted.data?.deleteStressTest).toBe(true);
  });

  it('rejects an unauthenticated list', async () => {
    const body = await gql<{ stressTests: StressTestBody[] }>(
      app,
      `query { stressTests { id } }`,
    );
    expect(body.errors?.[0]?.message).toMatch(/unauthorized/i);
  });
});
